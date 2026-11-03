-- Multi-tenant foundation.
--
-- One deployment serves many tenants. Every row owned by a tenant carries
-- tenant_id; the existing data belongs to the seeded default tenant so a
-- single-tenant deployment keeps working unchanged.

CREATE TABLE IF NOT EXISTS tenants (
    id         TEXT PRIMARY KEY,
    slug       TEXT NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Slugs are matched case-insensitively; handlers store them lower-case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (lower(slug));

INSERT INTO tenants (id, slug, name)
VALUES ('t_default', 'default', 'Default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_members (
    tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members (user_id);

-- Settings become (tenant_id, key). '' is the platform-wide fallback that
-- every tenant inherits; a tenant row overrides it.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings DROP CONSTRAINT settings_pkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (tenant_id, key);
    END IF;
END $$;

-- Every table whose rows belong to one tenant. Derived rows (a seat, an
-- activation, a release artifact) carry the column too: a query can then
-- filter directly instead of trusting a join to have been written.
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
        IF to_regclass(t) IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT %L',
            t, 't_default');
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
            'idx_' || t || '_tenant', t);
    END LOOP;
END $$;

-- Foreign keys keep a bad tenant_id from being written at all. audit_logs
-- is deliberately excluded: platform-level lines use the sentinel '' and
-- are not owned by any tenant.
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'products', 'plans', 'entitlements', 'licenses', 'activations',
        'seats', 'usage_events', 'usage_counters', 'api_keys',
        'webhooks', 'webhook_deliveries', 'analytics_snapshots',
        'subscriptions', 'floating_sessions', 'addons', 'license_addons',
        'metered_billing', 'plan_update_terms', 'license_renewals',
        'license_upgrades', 'releases', 'release_artifacts',
        'release_signing_keys'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF to_regclass(t) IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_tenant'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id)',
                t, 'fk_' || t || '_tenant');
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_licenses_tenant_user
    ON licenses (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_email
    ON licenses (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_seats_tenant_user
    ON seats (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_email
    ON seats (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created
    ON audit_logs (tenant_id, created_at);

-- Existing users join the default tenant. users.role remains the platform
-- role; tenant_members.role is the role inside this tenant.
INSERT INTO tenant_members (tenant_id, user_id, role)
SELECT 't_default', id,
       CASE WHEN role IN ('owner', 'admin') THEN role ELSE 'member' END
FROM users
ON CONFLICT DO NOTHING;

-- The default tenant inherits the operator's existing site name.
UPDATE tenants
SET name = COALESCE(
        NULLIF((SELECT value FROM settings WHERE tenant_id = '' AND key = 'site_name'), ''),
        name),
    updated_at = now()
WHERE id = 't_default' AND name = 'Default';
