ALTER TABLE "User" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'ZA', ADD COLUMN "province" TEXT, ADD COLUMN "phone" TEXT;
DROP INDEX "Evidence_milestoneId_type_key";
ALTER TABLE "Evidence" ADD COLUMN "scopeLearnerId" UUID REFERENCES "Learner"("id");
CREATE INDEX "Evidence_milestoneId_type_createdAt_idx" ON "Evidence"("milestoneId", "type", "createdAt");
CREATE TABLE "LearnerPack" (
 "id" UUID PRIMARY KEY, "cohortId" UUID NOT NULL REFERENCES "Cohort"("id"), "learnerId" UUID NOT NULL REFERENCES "Learner"("id"),
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "reason" TEXT, "assessorId" UUID, "submittedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LearnerPack_status_check" CHECK ("status" IN ('DRAFT','ASSESSOR_REVIEW','QA_REVIEW','VERIFIED','CHANGES_REQUESTED')),
 CONSTRAINT "LearnerPack_enrolment_fkey" FOREIGN KEY ("cohortId","learnerId") REFERENCES "Enrolment"("cohortId","learnerId")
);
CREATE UNIQUE INDEX "LearnerPack_cohortId_learnerId_key" ON "LearnerPack"("cohortId","learnerId");
