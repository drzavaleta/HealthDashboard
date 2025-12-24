import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * STEPS-DAILY EDGE FUNCTION (V2 - Hourly to Daily Aggregation)
 * 
 * Receives HOURLY aggregated step count from Auto Exporter.
 * Converts each hour to Chicago timezone, groups by day, and sums.
 * Stores one record per Chicago day.
 * 
 * Auto Exporter config:
 *   - Metric: Step Count
 *   - Aggregation: Hour
 *   - Source: Apple Watch only
 */

const OWNER_ID = "cac3a2da-0baa-491e-bf0d-01a2740b50eb";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract date from Auto Exporter format: "2025-12-18 06:00:00 -0600"
// The date string already contains local time with offset, so just extract YYYY-MM-DD
function extractLocalDate(dateString: string): string {
  // Format: "YYYY-MM-DD HH:MM:SS -HHMM"
  return dateString.split(' ')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const payload = await req.json();
    const metrics = payload?.data?.metrics || [];

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[steps-daily] Received payload with ${metrics.length} metrics.`);

    // Save raw payload for debugging
    await supabase.from('raw_health_exports').insert([{ 
      payload: { source: 'steps-daily', data: payload?.data },
      user_id: OWNER_ID 
    }]);

    // Map to accumulate steps by Chicago date
    const dailySteps = new Map<string, number>();

    for (const metric of metrics) {
      const name = metric.name?.toLowerCase();
      const data = metric.data || [];

      // Only process step count
      if (!name?.includes('step')) {
        console.log(`[steps-daily] Skipping non-step metric: ${metric.name}`);
        continue;
      }

      console.log(`[steps-daily] Processing ${data.length} hourly step records.`);

      for (const sample of data) {
        // Get the timestamp
        const rawDate = sample.date || sample.startDate;
        if (!rawDate) continue;

        // Get the value
        const val = parseFloat(sample.qty ?? sample.sum ?? sample.value ?? 0);
        if (isNaN(val) || val <= 0) continue;

        // Extract the local date directly from the date string
        // Auto Exporter sends: "2025-12-18 06:00:00 -0600" (already in local time)
        const chicagoDate = extractLocalDate(rawDate);

        // Accumulate steps for this Chicago day
        const existing = dailySteps.get(chicagoDate) || 0;
        dailySteps.set(chicagoDate, existing + val);
      }
    }

    console.log(`[steps-daily] Aggregated into ${dailySteps.size} Chicago days.`);

    // Convert to records for upsert
    const samples: Array<{
      user_id: string;
      metric_type: string;
      value: number;
      unit: string;
      source: string;
      recorded_at: string;
    }> = [];

    for (const [chicagoDate, steps] of dailySteps) {
      // Store at noon UTC for this date to avoid timezone boundary issues
      const recordedAt = `${chicagoDate}T12:00:00Z`;
      
      samples.push({
        user_id: OWNER_ID,
        metric_type: 'step_count',
        value: Math.round(steps), // Round to whole number
        unit: 'count',
        source: 'Apple Watch',
        recorded_at: recordedAt
      });

      console.log(`[steps-daily] ${chicagoDate}: ${Math.round(steps)} steps`);
    }

    let totalProcessed = 0;

    if (samples.length > 0) {
      const { error } = await supabase
        .from('health_samples')
        .upsert(samples, { onConflict: 'user_id, metric_type, source, recorded_at' });
      
      if (error) throw error;
      totalProcessed = samples.length;
    }

    console.log(`[steps-daily] Sync complete. Days processed: ${totalProcessed}`);

    return new Response(
      JSON.stringify({ 
        message: "Steps daily sync successful (V2 - hourly aggregation).",
        days_processed: totalProcessed,
        daily_totals: Object.fromEntries(dailySteps)
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("[steps-daily] Sync Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
