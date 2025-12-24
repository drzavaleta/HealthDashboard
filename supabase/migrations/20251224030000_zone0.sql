-- Add zone0_max for the "below Zone 1" threshold
-- Zone 0 is not displayed in charts but used for categorization

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS zone0_max INTEGER DEFAULT 90;

COMMENT ON COLUMN profiles.zone0_max IS 'Max HR for Zone 0 (below active zones). Not displayed in charts.';

