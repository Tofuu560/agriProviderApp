ALTER TABLE "User" ADD COLUMN "learnerId" UUID,
ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "requestedOrganisation" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" UUID,
ADD COLUMN "rejectionReason" TEXT;
CREATE UNIQUE INDEX "User_learnerId_key" ON "User"("learnerId");
ALTER TABLE "User" ADD CONSTRAINT "User_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" DROP CONSTRAINT user_role_valid;
ALTER TABLE "User" ADD CONSTRAINT user_role_valid CHECK (role IN ('ADMIN','PROVIDER','ASSESSOR','QA_OFFICER','LEARNER'));
ALTER TABLE "User" ADD CONSTRAINT learner_scope_required CHECK ((role = 'LEARNER') = ("learnerId" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT approval_status_valid CHECK ("approvalStatus" IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE "User" ADD CONSTRAINT active_requires_approval CHECK (status <> 'ACTIVE' OR "approvalStatus" = 'APPROVED');
CREATE OR REPLACE FUNCTION prevent_scope_mutation() RETURNS trigger AS $$ BEGIN
IF OLD.role IS DISTINCT FROM NEW.role OR OLD."providerId" IS DISTINCT FROM NEW."providerId" OR OLD."learnerId" IS DISTINCT FROM NEW."learnerId" THEN RAISE EXCEPTION 'Role and account scope are immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
ALTER TABLE "TrainingSession" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Training session';
CREATE TABLE "LearningMaterial" ("id" UUID NOT NULL, "cohortId" UUID NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "url" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id"));
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
