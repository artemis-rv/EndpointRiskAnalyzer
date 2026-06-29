-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('RATING', 'BUG', 'FEATURE_REQUEST', 'TESTIMONIAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ContactCategory" AS ENUM ('SALES', 'SUPPORT', 'BUG', 'FEATURE_REQUEST', 'PARTNERSHIP', 'GENERAL');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESPONDED', 'CLOSED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "Download" (
    "download_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "download_source" TEXT NOT NULL,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("download_id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "feedback_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rating" INTEGER,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("feedback_id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "contact_request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "ContactCategory" NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "handled_by_user_id" UUID,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("contact_request_id")
);

-- CreateIndex
CREATE INDEX "Download_user_id_idx" ON "Download"("user_id");

-- CreateIndex
CREATE INDEX "Download_release_id_idx" ON "Download"("release_id");

-- CreateIndex
CREATE INDEX "Download_downloaded_at_idx" ON "Download"("downloaded_at");

-- CreateIndex
CREATE INDEX "Feedback_user_id_idx" ON "Feedback"("user_id");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_featured_idx" ON "Feedback"("featured");

-- CreateIndex
CREATE INDEX "ContactRequest_user_id_idx" ON "ContactRequest"("user_id");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_handled_by_user_id_idx" ON "ContactRequest"("handled_by_user_id");

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "Release"("release_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_handled_by_user_id_fkey" FOREIGN KEY ("handled_by_user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
