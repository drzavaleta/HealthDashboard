import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * WORKOUTS-SYNC EDGE FUNCTION (V2)
 * 
 * Receives workout data from Auto Exporter and stores structured workout records.
 * Supports visualization by activity type, day, and week aggregation.
 * 
 * Auto Exporter config:
 *   - Data Type: Workouts
 *   - Aggregation: None (individual workouts)
 *   
 * Reference: https://github.com/Lybron/health-auto-export/wiki/API-Export---JSON-Format
 */

const OWNER_ID = "cac3a2da-0baa-491e-bf0d-01a2740b50eb";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract local date from Auto Exporter format: "2025-12-23 19:57:00 -0600"
function extractLocalDate(dateString: string): string {
  return dateString.split(' ')[0];
}

// Parse Auto Exporter date to ISO string
function parseDate(dateString: string): string {
  // Format: "2025-12-23 19:57:00 -0600"
  // Convert to ISO: "2025-12-23T19:57:00-06:00"
  const parts = dateString.split(' ');
  if (parts.length >= 3) {
    const date = parts[0];
    const time = parts[1];
    const tz = parts[2];
    // Format timezone: -0600 -> -06:00
    const tzFormatted = tz.slice(0, 3) + ':' + tz.slice(3);
    return `${date}T${time}${tzFormatted}`;
  }
  return dateString;
}

// Calculate heart rate stats from heartRateData array
function calculateHRStats(heartRateData: Array<{ Avg?: number; Max?: number; Min?: number }>) {
  if (!heartRateData || heartRateData.length === 0) {
    return { avg: null, max: null };
  }

  let totalAvg = 0;
  let maxHR = 0;
  let count = 0;

  for (const hr of heartRateData) {
    if (hr.Avg && typeof hr.Avg === 'number') {
      totalAvg += hr.Avg;
      count++;
    }
    if (hr.Max && typeof hr.Max === 'number' && hr.Max > maxHR) {
      maxHR = hr.Max;
    }
  }

  return {
    avg: count > 0 ? Math.round(totalAvg / count) : null,
    max: maxHR > 0 ? Math.round(maxHR) : null
  };
}

// Normalize activity type names for consistent grouping
function normalizeActivityType(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  // Group similar activities
  if (normalized.includes('walk') || normalized.includes('hiking')) {
    return 'Walking';
  }
  if (normalized.includes('run') || normalized.includes('jog')) {
    return 'Running';
  }
  if (normalized.includes('cycle') || normalized.includes('bike') || normalized.includes('cycling')) {
    return 'Cycling';
  }
  if (normalized.includes('swim')) {
    return 'Swimming';
  }
  if (normalized.includes('golf')) {
    return 'Golf';
  }
  if (normalized.includes('yoga')) {
    return 'Yoga';
  }
  if (normalized.includes('strength') || normalized.includes('weight') || normalized.includes('functional')) {
    return 'Strength Training';
  }
  if (normalized.includes('hiit') || normalized.includes('interval')) {
    return 'HIIT';
  }
  if (normalized.includes('elliptical')) {
    return 'Elliptical';
  }
  if (normalized.includes('rowing') || normalized.includes('rower')) {
    return 'Rowing';
  }
  if (normalized.includes('stair')) {
    return 'Stair Climbing';
  }
  if (normalized.includes('sauna')) {
    return 'Sauna';
  }
  
  // Return original with title case if no match
  return name.charAt(0).toUpperCase() + name.slice(1);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const payload = await req.json();
    
    // Workouts can be in different locations depending on payload structure
    const workouts = payload?.data?.workouts || payload?.workouts || [];

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[workouts-sync] Received ${workouts.length} workouts.`);

    // Save raw payload for debugging (can remove later)
    await supabase.from('raw_health_exports').insert([{ 
      payload: { source: 'workouts-sync', data: payload?.data },
      user_id: OWNER_ID 
    }]);

    const workoutRecords: Array<{
      id: string;
      user_id: string;
      activity_type: string;
      activity_raw: string;
      duration_min: number;
      calories_burned: number | null;
      distance_mi: number | null;
      avg_heart_rate: number | null;
      max_heart_rate: number | null;
      start_time: string;
      end_time: string;
      workout_date: string;
      location: string | null;
      temperature_f: number | null;
      humidity_pct: number | null;
    }> = [];

    for (const workout of workouts) {
      // Skip if no ID (can't deduplicate)
      if (!workout.id) {
        console.log(`[workouts-sync] Skipping workout without ID: ${workout.name}`);
        continue;
      }

      // Extract dates
      const startTime = parseDate(workout.start);
      const endTime = parseDate(workout.end);
      const workoutDate = extractLocalDate(workout.start);

      // Duration in minutes
      const durationMin = workout.duration ? Math.round(workout.duration / 60) : 0;

      // Calories
      const calories = workout.activeEnergyBurned?.qty 
        ? Math.round(workout.activeEnergyBurned.qty) 
        : null;

      // Distance (convert to miles if needed)
      let distanceMi: number | null = null;
      if (workout.distance?.qty) {
        if (workout.distance.units === 'km') {
          distanceMi = Math.round(workout.distance.qty * 0.621371 * 100) / 100;
        } else {
          distanceMi = Math.round(workout.distance.qty * 100) / 100;
        }
      }

      // Heart rate stats
      const hrStats = calculateHRStats(workout.heartRateData || []);

      // Temperature (convert to F if needed)
      let tempF: number | null = null;
      if (workout.temperature?.qty) {
        if (workout.temperature.units === 'degC') {
          tempF = Math.round((workout.temperature.qty * 9/5 + 32) * 10) / 10;
        } else {
          tempF = Math.round(workout.temperature.qty * 10) / 10;
        }
      }

      // Humidity
      const humidity = workout.humidity?.qty ? Math.round(workout.humidity.qty) : null;

      workoutRecords.push({
        id: workout.id,
        user_id: OWNER_ID,
        activity_type: normalizeActivityType(workout.name),
        activity_raw: workout.name,
        duration_min: durationMin,
        calories_burned: calories,
        distance_mi: distanceMi,
        avg_heart_rate: hrStats.avg,
        max_heart_rate: hrStats.max,
        start_time: startTime,
        end_time: endTime,
        workout_date: workoutDate,
        location: workout.location || null,
        temperature_f: tempF,
        humidity_pct: humidity
      });

      console.log(`[workouts-sync] Processed: ${workout.name} on ${workoutDate} - ${durationMin} min, ${calories || 0} kcal`);
    }

    // Upsert workouts (use id as unique key)
    let totalProcessed = 0;
    let totalHRRecords = 0;
    
    if (workoutRecords.length > 0) {
      const { error } = await supabase
        .from('workouts')
        .upsert(workoutRecords, { onConflict: 'id' });
      
      if (error) {
        console.error("[workouts-sync] Upsert error:", error);
        throw error;
      }
      totalProcessed = workoutRecords.length;
    }

    // Store per-minute heart rate data for zone analysis
    for (const workout of workouts) {
      if (!workout.id || !workout.heartRateData || workout.heartRateData.length === 0) {
        continue;
      }

      // Delete existing HR records for this workout (to handle re-syncs)
      await supabase
        .from('workout_heart_rate')
        .delete()
        .eq('workout_id', workout.id);

      // Build HR records
      const hrRecords = workout.heartRateData.map((hr: { date: string; Avg?: number; Min?: number; Max?: number }) => ({
        workout_id: workout.id,
        user_id: OWNER_ID,
        recorded_at: parseDate(hr.date),
        avg_hr: hr.Avg ? Math.round(hr.Avg) : null,
        min_hr: hr.Min ? Math.round(hr.Min) : null,
        max_hr: hr.Max ? Math.round(hr.Max) : null
      })).filter((r: { avg_hr: number | null }) => r.avg_hr !== null);

      if (hrRecords.length > 0) {
        const { error: hrError } = await supabase
          .from('workout_heart_rate')
          .insert(hrRecords);
        
        if (hrError) {
          console.error("[workouts-sync] HR insert error:", hrError);
        } else {
          totalHRRecords += hrRecords.length;
        }
      }
    }

    console.log(`[workouts-sync] HR records stored: ${totalHRRecords}`);

    console.log(`[workouts-sync] Sync complete. Workouts processed: ${totalProcessed}`);

    return new Response(
      JSON.stringify({ 
        message: "Workouts sync successful.",
        workouts_processed: totalProcessed,
        hr_records_stored: totalHRRecords,
        workouts: workoutRecords.map(w => ({
          activity: w.activity_type,
          date: w.workout_date,
          duration_min: w.duration_min,
          calories: w.calories_burned
        }))
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("[workouts-sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
