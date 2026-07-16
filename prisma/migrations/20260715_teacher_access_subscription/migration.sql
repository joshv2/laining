-- CreateEnum
CREATE TYPE "TeacherAccessSource" AS ENUM ('FREE', 'COUPON', 'STRIPE');

-- CreateEnum
CREATE TYPE "TeacherAccessStatus" AS ENUM ('ACTIVE', 'CANCELED');

-- CreateTable
CREATE TABLE "TeacherAccessSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TeacherAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "TeacherAccessSource" NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "couponId" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAccessSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAccessSubscription_userId_key" ON "TeacherAccessSubscription"("userId");

-- CreateIndex
CREATE INDEX "TeacherAccessSubscription_status_updatedAt_idx" ON "TeacherAccessSubscription"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TeacherAccessSubscription_source_updatedAt_idx" ON "TeacherAccessSubscription"("source", "updatedAt");

-- AddForeignKey
ALTER TABLE "TeacherAccessSubscription" ADD CONSTRAINT "TeacherAccessSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccessSubscription" ADD CONSTRAINT "TeacherAccessSubscription_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
