-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."RecordingSource" AS ENUM ('UPLOAD', 'BROWSER_RECORDING');

-- CreateEnum
CREATE TYPE "public"."RecordingStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RecordingVisibility" AS ENUM ('PUBLIC', 'ASSIGNMENT_ONLY');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'MODERATOR', 'SUPERUSER', 'TEACHER');

-- CreateEnum
CREATE TYPE "public"."UiLanguage" AS ENUM ('EN', 'HE');

-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('UPVOTE', 'DOWNVOTE');

-- CreateEnum
CREATE TYPE "public"."WorkType" AS ENUM ('TORAH', 'NEVIIM', 'KETUVIM');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Book" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHe" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassEnrollment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationDecision" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "nextStatus" "public"."RecordingStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pasuk" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "ref" TEXT NOT NULL,
    "hebrewText" TEXT,
    "englishText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pasuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasukBoundary" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "pasukId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "PasukBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaywalledAsset" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "currencyCode" TEXT DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaywalledAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlaybackEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "pasukId" TEXT,
    "eventType" TEXT NOT NULL,
    "positionMs" INTEGER,
    "durationMs" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teacherId" TEXT,

    CONSTRAINT "PlaybackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Portion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHe" TEXT NOT NULL,
    "workId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortionPasuk" (
    "id" TEXT NOT NULL,
    "portionId" TEXT NOT NULL,
    "pasukId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PortionPasuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PracticeAssignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "assignedByTeacherId" TEXT NOT NULL,
    "instructions" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryPasukId" TEXT NOT NULL,
    "rangeStartPasukId" TEXT NOT NULL,
    "rangeEndPasukId" TEXT NOT NULL,
    "source" "public"."RecordingSource" NOT NULL,
    "nussach" TEXT NOT NULL,
    "nussachCustom" TEXT,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" "public"."RecordingStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "moderationNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "autoAlignmentStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "visibility" "public"."RecordingVisibility" NOT NULL DEFAULT 'PUBLIC',
    "autoAlignmentCompletedAt" TIMESTAMP(3),
    "autoAlignmentResult" JSONB,
    "title" TEXT,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RevenueShareRule" (
    "id" TEXT NOT NULL,
    "recorderPercent" INTEGER NOT NULL,
    "platformPercent" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueShareRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherInvite" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherStudentLink" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "inviteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "preferredLanguage" "public"."UiLanguage" NOT NULL DEFAULT 'EN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "public"."Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "type" "public"."VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Work" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleHe" TEXT NOT NULL,
    "kind" "public"."WorkType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Book_workId_slug_key" ON "public"."Book"("workId" ASC, "slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_bookId_number_key" ON "public"."Chapter"("bookId" ASC, "number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_groupId_studentId_key" ON "public"."ClassEnrollment"("groupId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "ClassEnrollment_studentId_createdAt_idx" ON "public"."ClassEnrollment"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ClassGroup_teacherId_createdAt_idx" ON "public"."ClassGroup"("teacherId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ModerationDecision_moderatorId_createdAt_idx" ON "public"."ModerationDecision"("moderatorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ModerationDecision_recordingId_createdAt_idx" ON "public"."ModerationDecision"("recordingId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Pasuk_chapterId_number_key" ON "public"."Pasuk"("chapterId" ASC, "number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Pasuk_ref_key" ON "public"."Pasuk"("ref" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PasukBoundary_recordingId_pasukId_key" ON "public"."PasukBoundary"("recordingId" ASC, "pasukId" ASC);

-- CreateIndex
CREATE INDEX "PasukBoundary_recordingId_startMs_idx" ON "public"."PasukBoundary"("recordingId" ASC, "startMs" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PaywalledAsset_recordingId_key" ON "public"."PaywalledAsset"("recordingId" ASC);

-- CreateIndex
CREATE INDEX "PlaybackEvent_assignmentId_occurredAt_idx" ON "public"."PlaybackEvent"("assignmentId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "PlaybackEvent_recordingId_occurredAt_idx" ON "public"."PlaybackEvent"("recordingId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "PlaybackEvent_studentId_occurredAt_idx" ON "public"."PlaybackEvent"("studentId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "PlaybackEvent_teacherId_occurredAt_idx" ON "public"."PlaybackEvent"("teacherId" ASC, "occurredAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Portion_slug_key" ON "public"."Portion"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PortionPasuk_portionId_pasukId_key" ON "public"."PortionPasuk"("portionId" ASC, "pasukId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PortionPasuk_portionId_position_key" ON "public"."PortionPasuk"("portionId" ASC, "position" ASC);

-- CreateIndex
CREATE INDEX "PracticeAssignment_groupId_createdAt_idx" ON "public"."PracticeAssignment"("groupId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PracticeAssignment_recordingId_createdAt_idx" ON "public"."PracticeAssignment"("recordingId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Recording_primaryPasukId_status_idx" ON "public"."Recording"("primaryPasukId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Recording_status_createdAt_idx" ON "public"."Recording"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "TeacherInvite_email_expiresAt_idx" ON "public"."TeacherInvite"("email" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "TeacherInvite_groupId_createdAt_idx" ON "public"."TeacherInvite"("groupId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TeacherInvite_teacherId_createdAt_idx" ON "public"."TeacherInvite"("teacherId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInvite_token_key" ON "public"."TeacherInvite"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherStudentLink_inviteId_key" ON "public"."TeacherStudentLink"("inviteId" ASC);

-- CreateIndex
CREATE INDEX "TeacherStudentLink_studentId_createdAt_idx" ON "public"."TeacherStudentLink"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TeacherStudentLink_teacherId_createdAt_idx" ON "public"."TeacherStudentLink"("teacherId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherStudentLink_teacherId_studentId_key" ON "public"."TeacherStudentLink"("teacherId" ASC, "studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token" ASC);

-- CreateIndex
CREATE INDEX "Vote_recordingId_type_idx" ON "public"."Vote"("recordingId" ASC, "type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_recordingId_key" ON "public"."Vote"("userId" ASC, "recordingId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "public"."Work"("slug" ASC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Book" ADD CONSTRAINT "Book_workId_fkey" FOREIGN KEY ("workId") REFERENCES "public"."Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chapter" ADD CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassGroup" ADD CONSTRAINT "ClassGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationDecision" ADD CONSTRAINT "ModerationDecision_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationDecision" ADD CONSTRAINT "ModerationDecision_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pasuk" ADD CONSTRAINT "Pasuk_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasukBoundary" ADD CONSTRAINT "PasukBoundary_pasukId_fkey" FOREIGN KEY ("pasukId") REFERENCES "public"."Pasuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasukBoundary" ADD CONSTRAINT "PasukBoundary_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaybackEvent" ADD CONSTRAINT "PlaybackEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "public"."PracticeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaybackEvent" ADD CONSTRAINT "PlaybackEvent_pasukId_fkey" FOREIGN KEY ("pasukId") REFERENCES "public"."Pasuk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaybackEvent" ADD CONSTRAINT "PlaybackEvent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaybackEvent" ADD CONSTRAINT "PlaybackEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlaybackEvent" ADD CONSTRAINT "PlaybackEvent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Portion" ADD CONSTRAINT "Portion_workId_fkey" FOREIGN KEY ("workId") REFERENCES "public"."Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortionPasuk" ADD CONSTRAINT "PortionPasuk_pasukId_fkey" FOREIGN KEY ("pasukId") REFERENCES "public"."Pasuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortionPasuk" ADD CONSTRAINT "PortionPasuk_portionId_fkey" FOREIGN KEY ("portionId") REFERENCES "public"."Portion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeAssignment" ADD CONSTRAINT "PracticeAssignment_assignedByTeacherId_fkey" FOREIGN KEY ("assignedByTeacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeAssignment" ADD CONSTRAINT "PracticeAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PracticeAssignment" ADD CONSTRAINT "PracticeAssignment_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_primaryPasukId_fkey" FOREIGN KEY ("primaryPasukId") REFERENCES "public"."Pasuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_rangeEndPasukId_fkey" FOREIGN KEY ("rangeEndPasukId") REFERENCES "public"."Pasuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_rangeStartPasukId_fkey" FOREIGN KEY ("rangeStartPasukId") REFERENCES "public"."Pasuk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherInvite" ADD CONSTRAINT "TeacherInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherInvite" ADD CONSTRAINT "TeacherInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherInvite" ADD CONSTRAINT "TeacherInvite_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherStudentLink" ADD CONSTRAINT "TeacherStudentLink_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."TeacherInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherStudentLink" ADD CONSTRAINT "TeacherStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherStudentLink" ADD CONSTRAINT "TeacherStudentLink_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vote" ADD CONSTRAINT "Vote_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "public"."Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

