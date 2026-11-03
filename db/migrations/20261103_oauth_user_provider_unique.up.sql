-- One identity per provider per Keygate account. A user may sign in with
-- several providers, but two identities from the same provider would be
-- ambiguous: the account owner could not be told which subject is theirs,
-- and a second link could silently take over the account. Refuse to
-- apply while duplicates exist; merging two accounts hands one person
-- the other's access, so an operator resolves it by hand.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM oauth_accounts
        GROUP BY user_id, provider
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'oauth_accounts has duplicate (user_id, provider) pairs; resolve them before applying 20261103';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_user_provider
    ON oauth_accounts (user_id, provider);
