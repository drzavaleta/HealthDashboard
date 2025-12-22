import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * HEALTH-SYNC EDGE FUNCTION (V2 - CLEAN START)
 * 
 * This function takes raw sample data from Auto Health Exporter,
 * aggregates it into daily summaries, and syncs it to Supabase.
 */

const OWNER_ID = "cac3a2da-0baa-491e-bf0d-01a2740b50eb";

const SOURCE_NORMALIZATION: Record<string, string> = {
  "Jeffrey’s Apple Watch": "Apple Watch",
  "Jeffrey's Apple Watch": "Apple Watch",
  "DrZ iPhone 17 Pro": "iPhone",
  "DrZ iPhone": "iPhone"
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const payload = await req.json();
    const metrics = payload?.data?.metrics || [];

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Aggregation Object: agg[date][metric][source] = { sum, count, units }
    const agg: any = {};

    for (const metric of metrics) {
      const name = metric.name;
      const units = metric.units;
      const samples = metric.data || [];

      for (const sample of samples) {
        // 1. Source Handling (Take first source if multiple)
        let source = sample.source || "Unknown";
        if (source.includes('|')) {
          source = source.split('|')[0].trim();
        }

        // 2. Normalize Source Name (Replace non-breaking spaces with regular ones first)
        source = source.replace(/\u00A0/g, ' ');
        if (SOURCE_NORMALIZATION[source]) {
          source = SOURCE_NORMALIZATION[source];
        }

        // 3. Extract Date (YYYY-MM-DD)
        const rawDate = sample.date || sample.startDate || sample.recorded_at;
        if (!rawDate) continue;
        const date = rawDate.split(' ')[0];

        // 4. Get Value
        const qty = parseFloat(sample.qty || sample.value || 0);
        if (isNaN(qty)) continue;

        // 5. Aggregate
        // For sleep, we prefix the metric name with the stage
        const finalMetricName = name === 'sleep_analysis' 
          ? `sleep_${(sample.value || 'asleep').toLowerCase().replace(/\s+/g, '_')}`
          : name;

        if (!agg[date]) agg[date] = {};
        if (!agg[date][finalMetricName]) agg[date][finalMetricName] = {};
        if (!agg[date][finalMetricName][source]) {
          agg[date][finalMetricName][source] = { sum: 0, count: 0, units: units };
        }

        agg[date][finalMetricName][source].sum += qty;
        agg[date][finalMetricName][source].count += 1;
      }
    }

    // Prepare Records for Upsert
    const upsertData = [];

    for (const date in agg) {
      for (const metricName in agg[date]) {
        for (const source in agg[date][metricName]) {
          const item = agg[date][metricName][source];
          
          // Determine Aggregation Type (Average vs Sum)
          // Sum for steps, energy, distance, sleep hours
          // Average for heart rate, HRV, respiratory rate, etc.
          const sumMetrics = ['step', 'energy', 'distance', 'calories', 'sleep', 'active', 'flights'];
          const isSum = sumMetrics.some(m => metricName.toLowerCase().includes(m));
          
          const finalValue = isSum ? item.sum : (item.sum / item.count);

          upsertData.push({
            user_id: OWNER_ID,
            metric_type: metricName,
            value: finalValue,
            unit: item.units,
            source: source,
            recorded_at: `${date}T00:00:00+00:00` // Store at start of day for daily summary
          });
        }
      }
    }

    if (upsertData.length === 0) {
      return new Response(JSON.stringify({ message: "No data to sync" }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Sync to Database
    const { error } = await supabase
      .from('health_metrics')
      .upsert(upsertData, { 
        onConflict: 'user_id, metric_type, recorded_at, source' 
      });

    if (error) throw error;

    console.log(`Successfully synced ${upsertData.length} daily summaries.`);

    return new Response(
      JSON.stringify({ 
        message: "Data aggregated and synced successfully", 
        summaries_synced: upsertData.length 
      }),
      { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("Sync Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    );
  }
})

