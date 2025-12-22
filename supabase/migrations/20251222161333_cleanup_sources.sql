-- Cleanup migration: Fix source names and remove unreliable data
-- 1. Delete iPhone step data (unreliable since phone isn't always carried)
DELETE FROM health_samples 
WHERE metric_type = 'step_count' 
  AND source ILIKE '%iphone%';

-- 2. Fix pipe-delimited sources (take first source before the pipe)
-- First, normalize any that contain Apple Watch
UPDATE health_samples 
SET source = 'Apple Watch'
WHERE source LIKE '%|%' 
  AND source ILIKE '%watch%';

-- 3. Normalize any remaining pipe-delimited sources to first value
UPDATE health_samples 
SET source = TRIM(SPLIT_PART(source, '|', 1))
WHERE source LIKE '%|%';

-- 4. Normalize source names that weren't properly cleaned
UPDATE health_samples SET source = 'Apple Watch' WHERE source ILIKE '%watch%' AND source != 'Apple Watch';
UPDATE health_samples SET source = 'iPhone' WHERE source ILIKE '%iphone%' AND source != 'iPhone';
UPDATE health_samples SET source = 'Whoop' WHERE source ILIKE '%whoop%' AND source != 'Whoop';
UPDATE health_samples SET source = 'Eight Sleep' WHERE source ILIKE '%eight%' AND source != 'Eight Sleep';
UPDATE health_samples SET source = 'Lingo' WHERE source ILIKE '%lingo%' AND source != 'Lingo';

-- 5. Clean up non-breaking spaces in source names
UPDATE health_samples 
SET source = REPLACE(source, E'\u00A0', ' ')
WHERE source LIKE E'%\u00A0%';

-- 6. After normalization, delete any iPhone steps that were revealed
DELETE FROM health_samples 
WHERE metric_type = 'step_count' 
  AND source = 'iPhone';

