-- Add heart rate zone thresholds to profiles table
-- Each column stores the MAX heart rate for that zone
-- Zone 1 min is always 0, other zones min = previous zone max + 1

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS zone1_max INTEGER DEFAULT 99,
ADD COLUMN IF NOT EXISTS zone2_max INTEGER DEFAULT 119,
ADD COLUMN IF NOT EXISTS zone3_max INTEGER DEFAULT 139,
ADD COLUMN IF NOT EXISTS zone4_max INTEGER DEFAULT 159;

-- Zone 5 is implicitly zone4_max + 1 and above (no upper limit)

COMMENT ON COLUMN profiles.zone1_max IS 'Max HR for Zone 1 (Recovery). Min is 0.';
COMMENT ON COLUMN profiles.zone2_max IS 'Max HR for Zone 2 (Light Aerobic). Min is zone1_max + 1.';
COMMENT ON COLUMN profiles.zone3_max IS 'Max HR for Zone 3 (Aerobic). Min is zone2_max + 1.';
COMMENT ON COLUMN profiles.zone4_max IS 'Max HR for Zone 4 (Threshold). Min is zone3_max + 1.';

