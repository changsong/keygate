-- Revert multi-tenant foundation.
--
-- Only safe on an installation that never created a second tenant: tenant
-- rows and their data cannot be folded back into one tenant automatically.

DROP TABLE IF EXISTS tenant_members;

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'products', 'plans', 'entitlements', 'licenses', 'activations',
        'seats', 'usage_events', 'usage_counters', 'api_keys',
        'audit_logs', 'webhooks', 'webhook_deliveries',
        'analytics_snapshots', 'subscriptions', 'floating_sessions',
        'addons', 'license_addons', 'metered_billing',
        'plan_update_terms', 'license_renewals', 'license_upgrades',
        'releases', 'release_artifacts', 'release_signing_keys'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DROP COLUMN IF EXISTS tenant_id', t);
    END LOOP;
END $$;

DELETE FROM settings WHERE tenant_id <> '';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings DROP CONSTRAINT settings_pkey;
    END IF;
    ALTER TABLE settings DROP COLUMN IF EXISTS tenant_id;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key);
    END IF;
END $$;

DROP INDEX IF EXISTS idx_tenants_slug;
DROP TABLE IF EXISTS tenants;
