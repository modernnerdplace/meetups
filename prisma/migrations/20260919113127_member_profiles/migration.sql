-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isMct" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMvp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "profilePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profilePublicAt" TIMESTAMP(3),
ADD COLUMN     "username" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_username_key" ON "Member"("username");

-- CreateIndex
CREATE INDEX "Member_profilePublic_name_idx" ON "Member"("profilePublic", "name");

