-- Admin Settings Verification Tables Migration

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'string',
  category VARCHAR(50) NOT NULL,
  lastModified TIMESTAMP DEFAULT NOW(),
  modifiedBy VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  verificationStatus VARCHAR(50) DEFAULT 'pending',
  verificationTimestamp TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Create admin_settings_logs table
CREATE TABLE IF NOT EXISTS admin_settings_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settingKey VARCHAR(255) NOT NULL,
  oldValue TEXT,
  newValue TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  adminId UUID NOT NULL,
  adminEmail VARCHAR(255) NOT NULL,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(category);
CREATE INDEX IF NOT EXISTS idx_admin_settings_verified ON admin_settings(verified);
CREATE INDEX IF NOT EXISTS idx_admin_settings_logs_timestamp ON admin_settings_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_settings_logs_settingKey ON admin_settings_logs(settingKey);
CREATE INDEX IF NOT EXISTS idx_admin_settings_logs_adminId ON admin_settings_logs(adminId);

-- Insert default settings
INSERT INTO admin_settings (key, value, type, category, modifiedBy, verified, verificationStatus)
VALUES
  -- Fees
  ('withdrawal_fee_percent', '11.8', 'number', 'fees', 'system', true, 'verified'),
  ('deposit_fee_percent', '0', 'number', 'fees', 'system', true, 'verified'),
  ('trading_fee_percent', '0.5', 'number', 'fees', 'system', true, 'verified'),
  ('transfer_fee_percent', '0', 'number', 'fees', 'system', true, 'verified'),
  
  -- Wallet
  ('admin_wallet_address', '0x0000000000000000000000000000000000000000', 'string', 'wallet', 'system', false, 'pending'),
  ('treasury_wallet_address', '0x0000000000000000000000000000000000000000', 'string', 'wallet', 'system', false, 'pending'),
  ('custody_wallet_address', '0x0000000000000000000000000000000000000000', 'string', 'wallet', 'system', false, 'pending'),
  
  -- Bank
  ('bank_account_name', 'N/A', 'string', 'bank', 'system', false, 'pending'),
  ('bank_account_number', 'N/A', 'string', 'bank', 'system', false, 'pending'),
  ('bank_routing_number', 'N/A', 'string', 'bank', 'system', false, 'pending'),
  ('bank_swift_code', 'N/A', 'string', 'bank', 'system', false, 'pending'),
  
  -- Security
  ('two_factor_required', 'true', 'boolean', 'security', 'system', true, 'verified'),
  ('ip_whitelist_enabled', 'false', 'boolean', 'security', 'system', true, 'verified'),
  ('session_timeout_minutes', '30', 'number', 'security', 'system', true, 'verified'),
  ('max_login_attempts', '5', 'number', 'security', 'system', true, 'verified'),
  
  -- General
  ('platform_name', 'Verdexis', 'string', 'general', 'system', true, 'verified'),
  ('support_email', 'support@verdexis.com', 'string', 'general', 'system', true, 'verified'),
  ('maintenance_mode', 'false', 'boolean', 'general', 'system', true, 'verified'),
  ('signup_bonus_enabled', 'false', 'boolean', 'general', 'system', true, 'verified'),
  ('signup_bonus_amount', '0', 'number', 'general', 'system', true, 'verified')
ON CONFLICT (key) DO NOTHING;

-- Create view for settings summary
CREATE OR REPLACE VIEW admin_settings_summary AS
SELECT
  category,
  COUNT(*) as total,
  SUM(CASE WHEN verified = true THEN 1 ELSE 0 END) as verified_count,
  SUM(CASE WHEN verificationStatus = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN verificationStatus = 'pending' THEN 1 ELSE 0 END) as pending_count,
  MAX(lastModified) as last_modified
FROM admin_settings
GROUP BY category;

-- Create view for recent changes
CREATE OR REPLACE VIEW admin_settings_recent_changes AS
SELECT
  l.settingKey,
  l.oldValue,
  l.newValue,
  l.status,
  l.timestamp,
  l.adminEmail,
  l.errorMessage,
  ROW_NUMBER() OVER (PARTITION BY l.settingKey ORDER BY l.timestamp DESC) as change_number
FROM admin_settings_logs l
WHERE l.timestamp > NOW() - INTERVAL '30 days';

-- Create audit trigger
CREATE OR REPLACE FUNCTION audit_admin_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO admin_settings_logs (settingKey, oldValue, newValue, status, adminId, adminEmail)
    VALUES (NEW.key, OLD.value, NEW.value, 'success', 'system', NEW.modifiedBy);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_settings_audit_trigger ON admin_settings;
CREATE TRIGGER admin_settings_audit_trigger
AFTER UPDATE ON admin_settings
FOR EACH ROW
EXECUTE FUNCTION audit_admin_settings_changes();
