import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * HEALTH-SYNC EDGE FUNCTION (V6 - MINUTE AGGREGATION)
 * 
 * Optimized to handle large payloads by processing metrics one-by-one 
 * and using small database batches to stay under memory limits.
 * 
 * V5: Only accepts samples NEWER than the most recent stored timestamp
 * V6: Aggregates step_count to minute-level to prevent overcounting from
 *     per-second granularity data sent by Auto Exporter.
 */

// Helper: Round a date to the nearest minute
function roundToMinute(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  return rounded;
}

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

    // --- PRE-FETCH: Get latest timestamps for all metric/source combos ---
    // This prevents duplicate data from overlapping syncs
    // Only look at last 7 days for efficiency (syncs don't overlap more than that)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: latestTimestamps, error: tsError } = await supabase
      .from('health_samples')
      .select('metric_type, source, recorded_at')
      .eq('user_id', OWNER_ID)
      .gte('recorded_at', sevenDaysAgo.toISOString())
      .order('recorded_at', { ascending: false });
    
    if (tsError) console.error("Error fetching latest timestamps:", tsError);
    
    // Build a map of metric_type+source -> latest recorded_at
    const latestMap = new Map<string, Date>();
    for (const row of (latestTimestamps || [])) {
      const key = `${row.metric_type}_${row.source}`;
      if (!latestMap.has(key)) {
        latestMap.set(key, new Date(row.recorded_at));
      }
    }
    console.log(`Loaded ${latestMap.size} metric/source combos with existing data.`);

    // --- TIER 1: Save Raw Payload ---
    const { error: rawError } = await supabase.from('raw_health_exports').insert([{ 
      payload: payload,
      user_id: OWNER_ID 
    }]);
    if (rawError) console.error("Tier 1 (Raw Save) Error:", rawError);

    // --- TIER 2: Process Metrics One-by-One ---
    let totalProcessed = 0;
    let totalSkipped = 0;

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

        // --- DUPLICATE PREVENTION: Skip samples older than latest stored ---
        const latestKey = `${finalMetricName}_${source}`;
        const latestStored = latestMap.get(latestKey);
        const sampleDate = new Date(rawDate);
        
        if (latestStored && sampleDate <= latestStored) {
          totalSkipped++;
          continue; // Skip this sample - we already have it or newer
        }

        // --- MINUTE AGGREGATION for step_count ---
        // Auto Exporter sends per-second fractional values that overcount when summed.
        // Aggregate to minute-level: sum all values within each minute bucket.
        if (finalMetricName === 'step_count') {
          const minuteDate = roundToMinute(sampleDate);
          const minuteKey = `${minuteDate.toISOString()}_${source}_${finalMetricName}`;
          
          const existing = dedupedMap.get(minuteKey);
          if (existing) {
            // Add to existing minute bucket
            existing.value += val;
          } else {
            // Create new minute bucket
            dedupedMap.set(minuteKey, {
              user_id: OWNER_ID,
              metric_type: finalMetricName,
              value: val,
              unit: units,
              source: source,
              recorded_at: minuteDate.toISOString()
            });
          }
        } else {
          // Non-step metrics: keep per-second granularity
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

    console.log(`Sync complete. Processed: ${totalProcessed}, Skipped (already stored): ${totalSkipped}`);

    return new Response(
      JSON.stringify({ 
        message: "Sync successful (V6 - minute aggregation for steps).", 
        samples_processed: totalProcessed,
        samples_skipped: totalSkipped
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
