-- ============================================================
-- Aditya Lens — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Add new columns to license_keys table
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS device_ids TEXT[] DEFAULT '{}';
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS max_devices INTEGER DEFAULT 1;
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 2. Update existing licenses to have correct max_devices based on tier
UPDATE license_keys SET max_devices = 1 WHERE tier_level = 1 AND max_devices IS NULL;
UPDATE license_keys SET max_devices = 3 WHERE tier_level = 2 AND max_devices IS NULL;
UPDATE license_keys SET max_devices = 5 WHERE tier_level = 3 AND max_devices IS NULL;
UPDATE license_keys SET max_devices = 25 WHERE tier_level = 4 AND max_devices IS NULL;

-- 3. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_license_keys_key_string ON license_keys(key_string);
CREATE INDEX IF NOT EXISTS idx_license_keys_stripe_customer ON license_keys(stripe_customer);
CREATE INDEX IF NOT EXISTS idx_license_keys_active ON license_keys(is_active, tier_level);

-- 4. Validation log table (tracks every license check from the desktop app)
CREATE TABLE IF NOT EXISTS validation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT,
  result TEXT NOT NULL CHECK (result IN ('valid', 'invalid', 'expired', 'device_limit', 'deactivated', 'not_found')),
  tier_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_log_key ON validation_log(license_key, created_at DESC);

-- 5. RLS: protect license_keys (only service_role can access)
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Allow anon read for basic validation (key_string + is_active check only)
-- The validate-license endpoint uses service_role so this is just a safety net
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon can check active keys' AND tablename = 'license_keys') THEN
    CREATE POLICY "Anon can check active keys" ON license_keys
      FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- 6. Done! Verify:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'license_keys' ORDER BY ordinal_position;
