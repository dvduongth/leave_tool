-- CreateEnum
CREATE TYPE "MenstrualMode" AS ENUM ('SHORT', 'LONG');

-- AlterTable
ALTER TABLE "menstrual_leaves" ADD COLUMN "mode" "MenstrualMode" NOT NULL DEFAULT 'SHORT';
