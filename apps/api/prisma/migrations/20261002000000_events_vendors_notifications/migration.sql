-- Client workflow v2: user-assessed conditions, listing status + asking price,
-- profile handle/location/socials, Vendor Mode, events, vendor applications,
-- event inventory, notifications, counteroffer tracking and trade snapshots.
-- Hand-written where Prisma's diff would lose data (enum/column rewrites).

-- -- Conditions: rename in place so existing rows keep their meaning --
ALTER TYPE "CardCondition" RENAME VALUE 'LIGHTLY_PLAYED' TO 'EXCELLENT';
ALTER TYPE "CardCondition" RENAME VALUE 'MODERATELY_PLAYED' TO 'GOOD';
ALTER TYPE "CardCondition" RENAME VALUE 'HEAVILY_PLAYED' TO 'PLAYED';
ALTER TYPE "CardCondition" RENAME VALUE 'DAMAGED' TO 'POOR';
ALTER TYPE "CardCondition" ADD VALUE 'MINT' BEFORE 'NEAR_MINT';
ALTER TYPE "CardCondition" ADD VALUE 'VERY_GOOD' BEFORE 'GOOD';

-- Price tier keys embed the condition name.
UPDATE "CollectionItem" SET "priceTierKey" = CASE "priceTierKey"
  WHEN 'RAW:LIGHTLY_PLAYED' THEN 'RAW:EXCELLENT'
  WHEN 'RAW:MODERATELY_PLAYED' THEN 'RAW:GOOD'
  WHEN 'RAW:HEAVILY_PLAYED' THEN 'RAW:PLAYED'
  WHEN 'RAW:DAMAGED' THEN 'RAW:POOR'
  ELSE "priceTierKey" END
WHERE "priceTierKey" IN ('RAW:LIGHTLY_PLAYED', 'RAW:MODERATELY_PLAYED', 'RAW:HEAVILY_PLAYED', 'RAW:DAMAGED');
UPDATE "CardPriceHistory" SET "priceTierKey" = CASE "priceTierKey"
  WHEN 'RAW:LIGHTLY_PLAYED' THEN 'RAW:EXCELLENT'
  WHEN 'RAW:MODERATELY_PLAYED' THEN 'RAW:GOOD'
  WHEN 'RAW:HEAVILY_PLAYED' THEN 'RAW:PLAYED'
  WHEN 'RAW:DAMAGED' THEN 'RAW:POOR'
  ELSE "priceTierKey" END
WHERE "priceTierKey" IN ('RAW:LIGHTLY_PLAYED', 'RAW:MODERATELY_PLAYED', 'RAW:HEAVILY_PLAYED', 'RAW:DAMAGED');
UPDATE "CardMarketValue" SET "priceTierKey" = CASE "priceTierKey"
  WHEN 'RAW:LIGHTLY_PLAYED' THEN 'RAW:EXCELLENT'
  WHEN 'RAW:MODERATELY_PLAYED' THEN 'RAW:GOOD'
  WHEN 'RAW:HEAVILY_PLAYED' THEN 'RAW:PLAYED'
  WHEN 'RAW:DAMAGED' THEN 'RAW:POOR'
  ELSE "priceTierKey" END
WHERE "priceTierKey" IN ('RAW:LIGHTLY_PLAYED', 'RAW:MODERATELY_PLAYED', 'RAW:HEAVILY_PLAYED', 'RAW:DAMAGED');
UPDATE "CardMarketValueDaily" SET "priceTierKey" = CASE "priceTierKey"
  WHEN 'RAW:LIGHTLY_PLAYED' THEN 'RAW:EXCELLENT'
  WHEN 'RAW:MODERATELY_PLAYED' THEN 'RAW:GOOD'
  WHEN 'RAW:HEAVILY_PLAYED' THEN 'RAW:PLAYED'
  WHEN 'RAW:DAMAGED' THEN 'RAW:POOR'
  ELSE "priceTierKey" END
WHERE "priceTierKey" IN ('RAW:LIGHTLY_PLAYED', 'RAW:MODERATELY_PLAYED', 'RAW:HEAVILY_PLAYED', 'RAW:DAMAGED');
UPDATE "TradeItem" SET "priceTierKey" = CASE "priceTierKey"
  WHEN 'RAW:LIGHTLY_PLAYED' THEN 'RAW:EXCELLENT'
  WHEN 'RAW:MODERATELY_PLAYED' THEN 'RAW:GOOD'
  WHEN 'RAW:HEAVILY_PLAYED' THEN 'RAW:PLAYED'
  WHEN 'RAW:DAMAGED' THEN 'RAW:POOR'
  ELSE "priceTierKey" END
WHERE "priceTierKey" IN ('RAW:LIGHTLY_PLAYED', 'RAW:MODERATELY_PLAYED', 'RAW:HEAVILY_PLAYED', 'RAW:DAMAGED');

-- -- Listing status replaces visibility (PRIVATE/VISIBLE -> PERSONAL, TRADEABLE -> FOR_TRADE) --
CREATE TYPE "ListingStatus" AS ENUM ('PERSONAL', 'FOR_TRADE', 'FOR_SALE', 'TRADE_AND_SALE');
ALTER TABLE "CollectionItem"
  ADD COLUMN "listingStatus" "ListingStatus" NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN "askingPriceCents" INTEGER,
  ADD COLUMN "backImageKey" VARCHAR(255);
UPDATE "CollectionItem" SET "listingStatus" = 'FOR_TRADE' WHERE "visibility" = 'TRADEABLE';
DROP INDEX "CollectionItem_userId_visibility_idx";
ALTER TABLE "CollectionItem" DROP COLUMN "visibility";
DROP TYPE "ItemVisibility";
CREATE INDEX "CollectionItem_userId_listingStatus_idx" ON "CollectionItem"("userId", "listingStatus");
ALTER TABLE "CollectionItem"
  ADD CONSTRAINT "CollectionItem_asking_price_nonnegative" CHECK ("askingPriceCents" IS NULL OR "askingPriceCents" >= 0);

-- -- Profile: unique handle, location, social links --
ALTER TABLE "Profile"
  ADD COLUMN "username" VARCHAR(20),
  ADD COLUMN "location" VARCHAR(80),
  ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '{}';
UPDATE "Profile" SET "username" = 'user_' || substr(md5("userId"::text), 1, 12);
ALTER TABLE "Profile" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,20}$');

-- -- Trades --
ALTER TABLE "Trade"
  ADD COLUMN "eventId" UUID,
  ADD COLUMN "proposalCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Trade" SET "proposalCount" = 1 WHERE "proposedAt" IS NOT NULL;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_proposal_count_nonnegative" CHECK ("proposalCount" >= 0);
ALTER TABLE "TradeItem"
  ADD COLUMN "certNumber" VARCHAR(40),
  ADD COLUMN "comps" JSONB NOT NULL DEFAULT '[]';
UPDATE "TradeItem" ti SET "certNumber" = ci."certNumber"
  FROM "CollectionItem" ci WHERE ci.id = ti."collectionItemId";

-- -- New enums --
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
CREATE TYPE "VendorApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "NotificationType" AS ENUM ('TRADE_OFFER', 'TRADE_COUNTER', 'TRADE_ACCEPTED', 'TRADE_DECLINED', 'TRADE_CANCELLED', 'TRADE_TERMS_CHANGED', 'TRADE_COMPLETED', 'REVIEW_RECEIVED', 'VENDOR_APPLICATION', 'VENDOR_APPROVED', 'VENDOR_DECLINED', 'EVENT_UPDATED', 'EVENT_CANCELLED', 'EVENT_REMINDER');

-- CreateTable
CREATE TABLE "VendorProfile" (
    "userId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessName" VARCHAR(60) NOT NULL,
    "logoKey" VARCHAR(255),
    "description" VARCHAR(1000),
    "website" VARCHAR(200),
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "organizerId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(4000),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "venueName" VARCHAR(120) NOT NULL,
    "address" VARCHAR(200),
    "city" VARCHAR(80) NOT NULL,
    "region" VARCHAR(80),
    "country" VARCHAR(56) NOT NULL DEFAULT 'US',
    "admission" VARCHAR(120),
    "organizerName" VARCHAR(80),
    "website" VARCHAR(200),
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventVendor" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "tableNumber" VARCHAR(20),
    "message" VARCHAR(500),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInventoryItem" (
    "eventVendorId" UUID NOT NULL,
    "collectionItemId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInventoryItem_pkey" PRIMARY KEY ("eventVendorId","collectionItemId")
);

-- CreateTable
CREATE TABLE "EventSave" (
    "userId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSave_pkey" PRIMARY KEY ("userId","eventId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_organizerId_startsAt_idx" ON "Event"("organizerId", "startsAt");

-- CreateIndex
CREATE INDEX "EventVendor_vendorId_status_idx" ON "EventVendor"("vendorId", "status");

-- CreateIndex
CREATE INDEX "EventVendor_eventId_status_idx" ON "EventVendor"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventVendor_eventId_vendorId_key" ON "EventVendor"("eventId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "EventVendor_eventId_tableNumber_key" ON "EventVendor"("eventId", "tableNumber");

-- CreateIndex
CREATE INDEX "EventInventoryItem_collectionItemId_idx" ON "EventInventoryItem"("collectionItemId");

-- CreateIndex
CREATE INDEX "EventSave_eventId_idx" ON "EventSave"("eventId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVendor" ADD CONSTRAINT "EventVendor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventVendor" ADD CONSTRAINT "EventVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_eventVendorId_fkey" FOREIGN KEY ("eventVendorId") REFERENCES "EventVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSave" ADD CONSTRAINT "EventSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSave" ADD CONSTRAINT "EventSave_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- -- Constraints Prisma cannot express --
ALTER TABLE "Event" ADD CONSTRAINT "Event_ends_after_start" CHECK ("endsAt" >= "startsAt");
ALTER TABLE "EventVendor" ADD CONSTRAINT "EventVendor_table_only_when_approved"
  CHECK ("tableNumber" IS NULL OR "status" = 'APPROVED');
CREATE INDEX "Event_title_trgm_idx" ON "Event" USING GIN ("title" gin_trgm_ops);
