-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'PRO');

-- AlterTable: Add tier to User
ALTER TABLE "User" ADD COLUMN "tier" "UserTier" NOT NULL DEFAULT 'FREE';

-- AlterTable: Add indexedWith to Repo
ALTER TABLE "Repo" ADD COLUMN "indexedWith" TEXT;
