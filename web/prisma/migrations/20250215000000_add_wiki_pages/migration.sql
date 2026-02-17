-- Add wiki pages column for dynamic documentation structure
ALTER TABLE "Documentation" ADD COLUMN IF NOT EXISTS "pages" JSONB;

-- Make legacy columns nullable for backward compatibility
ALTER TABLE "Documentation" ALTER COLUMN "overview" DROP NOT NULL;
ALTER TABLE "Documentation" ALTER COLUMN "gettingStarted" DROP NOT NULL;
ALTER TABLE "Documentation" ALTER COLUMN "coreArchitecture" DROP NOT NULL;
ALTER TABLE "Documentation" ALTER COLUMN "apiReference" DROP NOT NULL;
ALTER TABLE "Documentation" ALTER COLUMN "usagePatterns" DROP NOT NULL;
ALTER TABLE "Documentation" ALTER COLUMN "developmentGuide" DROP NOT NULL;
