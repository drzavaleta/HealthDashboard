-- 1. Create the raw samples table
CREATE TABLE IF NOT EXISTS health_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  value FLOAT8 NOT NULL,
  unit TEXT,
  source TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_sample UNIQUE (user_id, metric_type, source, recorded_at)
);

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_health_samples_query ON health_samples (user_id, metric_type, recorded_at);

-- 3. Drop the old table so we can replace it with a View
DROP TABLE IF EXISTS health_metrics;

-- 4. Create the View for the dashboard
CREATE OR REPLACE VIEW health_metrics AS
SELECT
  user_id,
  metric_type,
  CASE 
    WHEN metric_type ILIKE ANY (ARRAY['%step%', '%energy%', '%distance%', '%calories%', '%sleep%', '%active%', '%flights%']) THEN SUM(value)
    ELSE AVG(value)
  END as value,
  MAX(unit) as unit,
  source,
  date_trunc('day', recorded_at) as recorded_at
FROM health_samples
GROUP BY user_id, metric_type, source, date_trunc('day', recorded_at);

