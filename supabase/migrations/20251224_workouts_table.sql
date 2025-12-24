-- Workouts table for storing Apple Watch workout data
-- Supports visualization by activity type, day, and week aggregation

DROP TABLE IF EXISTS workouts;

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,  -- UUID from Apple Health for deduplication
  user_id UUID NOT NULL REFERENCES auth.users(id),
  activity_type TEXT NOT NULL,  -- Normalized activity type (Walking, Running, etc.)
  activity_raw TEXT,  -- Original activity name from Apple Health
  duration_min INTEGER NOT NULL,  -- Duration in minutes
  calories_burned INTEGER,  -- Active calories burned
  distance_mi NUMERIC(6,2),  -- Distance in miles
  avg_heart_rate INTEGER,  -- Average heart rate during workout
  max_heart_rate INTEGER,  -- Maximum heart rate during workout
  start_time TIMESTAMPTZ NOT NULL,  -- Workout start time
  end_time TIMESTAMPTZ NOT NULL,  -- Workout end time
  workout_date DATE NOT NULL,  -- Date for easy day/week grouping
  location TEXT,  -- Indoor, Outdoor, Pool, Open Water
  temperature_f NUMERIC(4,1),  -- Temperature in Fahrenheit
  humidity_pct INTEGER,  -- Humidity percentage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient date-based queries
CREATE INDEX idx_workouts_date ON workouts(workout_date);
CREATE INDEX idx_workouts_user_date ON workouts(user_id, workout_date);
CREATE INDEX idx_workouts_activity ON workouts(activity_type);

-- Enable RLS
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

-- RLS policy for user access
CREATE POLICY "Users can view own workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access" ON workouts
  FOR ALL USING (true) WITH CHECK (true);

