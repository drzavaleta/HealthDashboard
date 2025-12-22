import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * HEALTH-SYNC EDGE FUNCTION (V4 - MEMORY OPTIMIZED)
 * 
 * Optimized to handle large payloads by processing metrics one-by-one 
 * and using small database batches to stay under memory limits.
 */

const OWNER_ID = "cac3a2da-0baa-491e-bf0d-01a2740b50eb";

const SOURCE_NORMALIZATION: Record<string, string> = {
  "Jeffrey’s Apple Watch": "Apple Watch",
  "Jeffrey's Apple Watch": "Apple Watch",
  "DrZ iPhone 17 Pro": "iPhone",
  "DrZ iPhone": "iPhone",
  "Lingo": "Lingo"
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const payload = await req.json();
    const metrics = payload?.data?.metrics || [];

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Received payload with ${metrics.length} metrics. Starting processing...`);

    // --- TIER 1: Save Raw Payload ---
    const { error: rawError } = await supabase.from('raw_health_exports').insert([{ 
      payload: payload,
      user_id: OWNER_ID 
    }]);
    if (rawError) console.error("Tier 1 (Raw Save) Error:", rawError);

    // --- TIER 2: Process Metrics One-by-One ---
    let totalProcessed = 0;

    for (const metric of metrics) {
      const name = metric.name;
      const units = metric.units;
      const data = metric.data || [];
      
      // Use a Map to deduplicate samples within this metric before batching
      // Unique Key: recorded_at + source
      const dedupedMap = new Map();

      for (const sample of data) {
        // 1. Source Handling
        let source = sample.source || "Unknown";
        if (source.includes('|')) source = source.split('|')[0].trim();

        // 2. Normalize Source Name (Basic cleaning)
        source = source.replace(/\u00A0/g, ' '); 
        
        // 3. Date Handling
        const rawDate = sample.date || sample.startDate || sample.recorded_at;
        if (!rawDate) continue;

        // 4. Value Handling
        const val = parseFloat(sample.qty ?? sample.Avg ?? sample.value ?? 0);
        if (isNaN(val)) continue;

        // 5. Metric Name Cleanup
        let finalMetricName = name === 'sleep_analysis' 
          ? `sleep_${(sample.value || 'asleep').toLowerCase().replace(/\s+/g, '_')}`
          : name;

        // Advanced cleaning & normalization
        const lowSource = source.toLowerCase();
        let normalized = false;
        if (lowSource.includes('eight')) { source = "Eight Sleep"; normalized = true; }
        else if (lowSource.includes('whoop')) { source = "Whoop"; normalized = true; }
        else if (lowSource.includes('watch') || lowSource.includes('health')) { source = "Apple Watch"; normalized = true; }
        else if (lowSource.includes('iphone')) { source = "iPhone"; normalized = true; }
        else if (lowSource.includes('lingo')) { source = "Lingo"; normalized = true; }
        
        if (!normalized && SOURCE_NORMALIZATION[source]) {
          source = SOURCE_NORMALIZATION[source];
          normalized = true;
        }

        if (!normalized) {
          console.log(`[UNRECOGNIZED SOURCE] Metric: ${finalMetricName}, Source: ${source}`);
        }

        // Special case: Eight Sleep heart rate counts as Resting Heart Rate
        if (finalMetricName === 'heart_rate' && source === 'Eight Sleep') {
          finalMetricName = 'resting_heart_rate';
        }

        // Special case: Ignore iPhone steps as they are unreliable
        if (finalMetricName === 'step_count' && source === 'iPhone') {
          continue;
        }

        const uniqueKey = `${rawDate}_${source}_${finalMetricName}`;
        dedupedMap.set(uniqueKey, {
          user_id: OWNER_ID,
          metric_type: finalMetricName,
          value: val,
          unit: units,
          source: source,
          recorded_at: rawDate
        });
      }

      const allMetricSamples = Array.from(dedupedMap.values());
      console.log(`Metric ${name}: ${allMetricSamples.length} unique samples found.`);

      // 6. Batch Upsert
      const BATCH_SIZE = 500;
      for (let i = 0; i < allMetricSamples.length; i += BATCH_SIZE) {
        const batch = allMetricSamples.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('health_samples')
          .upsert(batch, { onConflict: 'user_id, metric_type, source, recorded_at' });
        
        if (error) throw error;
        totalProcessed += batch.length;
      }
      
      console.log(`Finished metric: ${name}`);
    }

    // --- TIER 3: Cleanup ---
    // Delete raw payloads older than 2 days to save storage space
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const { error: cleanupError } = await supabase
      .from('raw_health_exports')
      .delete()
      .lt('created_at', twoDaysAgo.toISOString());

    if (cleanupError) console.error("Storage Cleanup Error:", cleanupError);

    return new Response(
      JSON.stringify({ 
        message: "Memory-optimized sync successful.", 
        samples_processed: totalProcessed 
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Sync Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
