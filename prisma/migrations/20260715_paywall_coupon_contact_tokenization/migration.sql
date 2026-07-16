-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('PURCHASE', 'COUPON', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('CONTACT_SUBMISSION');

-- CreateEnum
CREATE TYPE "TokenizationEventType" AS ENUM ('MODERATION_APPROVED', 'MODERATION_REJECTED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'ASSIGNMENT_DELETED');

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "maxRedemptions" INTEGER,
    "redeemBy" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "paywalledAssetId" TEXT,
    "couponId" TEXT,
    "currencyCode" TEXT NOT NULL,
    "baseAmountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "finalAmountCents" INTEGER NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "source" "EntitlementSource" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contextUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperuserNotification" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "eventType" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperuserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenizationRule" (
    "id" TEXT NOT NULL,
    "eventType" "TokenizationEventType" NOT NULL,
    "tokenDelta" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenizationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenLedgerEntry" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "eventType" "TokenizationEventType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "tokenDelta" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_active_redeemBy_idx" ON "Coupon"("active", "redeemBy");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_createdAt_idx" ON "CouponRedemption"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_couponId_userId_key" ON "CouponRedemption"("couponId", "userId");

-- CreateIndex
CREATE INDEX "RecordingPurchase_userId_createdAt_idx" ON "RecordingPurchase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordingPurchase_recordingId_createdAt_idx" ON "RecordingPurchase"("recordingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingEntitlement_purchaseId_key" ON "RecordingEntitlement"("purchaseId");

-- CreateIndex
CREATE INDEX "RecordingEntitlement_recordingId_createdAt_idx" ON "RecordingEntitlement"("recordingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingEntitlement_userId_recordingId_key" ON "RecordingEntitlement"("userId", "recordingId");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_email_createdAt_idx" ON "ContactMessage"("email", "createdAt");

-- CreateIndex
CREATE INDEX "SuperuserNotification_readAt_createdAt_idx" ON "SuperuserNotification"("readAt", "createdAt");

-- CreateIndex
CREATE INDEX "SuperuserNotification_eventType_createdAt_idx" ON "SuperuserNotification"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TokenizationRule_eventType_key" ON "TokenizationRule"("eventType");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_recipientId_createdAt_idx" ON "TokenLedgerEntry"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_eventType_createdAt_idx" ON "TokenLedgerEntry"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "PaywalledAsset" ADD CONSTRAINT "PaywalledAsset_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "RecordingPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPurchase" ADD CONSTRAINT "RecordingPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPurchase" ADD CONSTRAINT "RecordingPurchase_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPurchase" ADD CONSTRAINT "RecordingPurchase_paywalledAssetId_fkey" FOREIGN KEY ("paywalledAssetId") REFERENCES "PaywalledAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingPurchase" ADD CONSTRAINT "RecordingPurchase_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingEntitlement" ADD CONSTRAINT "RecordingEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingEntitlement" ADD CONSTRAINT "RecordingEntitlement_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingEntitlement" ADD CONSTRAINT "RecordingEntitlement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "RecordingPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

