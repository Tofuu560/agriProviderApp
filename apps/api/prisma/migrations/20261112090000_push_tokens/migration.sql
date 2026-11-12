ALTER TABLE "User" ADD COLUMN "pushTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE OR REPLACE FUNCTION prevent_scope_mutation() RETURNS trigger AS $$ BEGIN
IF OLD.role IS DISTINCT FROM NEW.role OR OLD."providerId" IS DISTINCT FROM NEW."providerId" THEN RAISE EXCEPTION 'Role and provider scope are immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER user_scope_immutable BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION prevent_scope_mutation();
