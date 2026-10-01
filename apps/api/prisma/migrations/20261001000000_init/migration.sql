-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('POKEMON', 'ONE_PIECE', 'SPORTS');

-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('RAW', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED', 'GRADED');

-- CreateEnum
CREATE TYPE "GradingCompany" AS ENUM ('PSA', 'BGS', 'CGC', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemVisibility" AS ENUM ('PRIVATE', 'VISIBLE', 'TRADEABLE');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('SEED', 'IMPORT', 'USER_SUBMITTED');

-- CreateEnum
CREATE TYPE "ValueConfidence" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('DRAFT', 'PROPOSED', 'ACCEPTED', 'COMPLETED', 'CANCELLED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TradeRole" AS ENUM ('INITIATOR', 'COUNTERPARTY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "publicId" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "bio" VARCHAR(280),
    "avatarKey" VARCHAR(255),
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedTradeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" UUID NOT NULL,
    "category" "CardCategory" NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "year" INTEGER,
    "manufacturer" VARCHAR(80),
    "releaseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "category" "CardCategory" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "cardNumber" VARCHAR(32) NOT NULL,
    "subject" VARCHAR(120),
    "variant" VARCHAR(80) NOT NULL DEFAULT '',
    "rarity" VARCHAR(40),
    "imageUrl" VARCHAR(500),
    "source" "CatalogSource" NOT NULL DEFAULT 'SEED',
    "externalRef" VARCHAR(120),
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "submittedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "CardCondition" NOT NULL DEFAULT 'RAW',
    "gradingCompany" "GradingCompany",
    "grade" DECIMAL(3,1),
    "certNumber" VARCHAR(40),
    "priceTierKey" VARCHAR(40) NOT NULL,
    "purchasePriceCents" INTEGER,
    "purchaseDate" DATE,
    "notes" VARCHAR(1000),
    "customImageKey" VARCHAR(255),
    "visibility" "ItemVisibility" NOT NULL DEFAULT 'PRIVATE',
    "estimatedValueCents" INTEGER,
    "valueUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSource" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPriceHistory" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "priceTierKey" VARCHAR(40) NOT NULL,
    "condition" "CardCondition" NOT NULL,
    "gradingCompany" "GradingCompany",
    "grade" DECIMAL(3,1),
    "priceCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "soldAt" TIMESTAMP(3) NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "sourceReference" VARCHAR(120) NOT NULL,
    "listingTitle" VARCHAR(300),
    "matchConfidence" DECIMAL(3,2),
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardMarketValue" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "priceTierKey" VARCHAR(40) NOT NULL,
    "valueCents" INTEGER,
    "confidence" "ValueConfidence" NOT NULL DEFAULT 'NONE',
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "algorithm" VARCHAR(40),
    "lastSaleAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3),
    "nextRefreshAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshPriority" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardMarketValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardMarketValueDaily" (
    "cardId" UUID NOT NULL,
    "priceTierKey" VARCHAR(40) NOT NULL,
    "date" DATE NOT NULL,
    "valueCents" INTEGER NOT NULL,

    CONSTRAINT "CardMarketValueDaily_pkey" PRIMARY KEY ("cardId","priceTierKey","date")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "category" "CardCategory" NOT NULL,
    "valueCents" BIGINT NOT NULL,
    "cardCount" INTEGER NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("userId","date","category")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" UUID NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "suggestedCashPayer" "TradeRole",
    "suggestedCashCents" INTEGER NOT NULL DEFAULT 0,
    "agreedCashPayer" "TradeRole",
    "agreedCashCents" INTEGER NOT NULL DEFAULT 0,
    "cashIsManual" BOOLEAN NOT NULL DEFAULT false,
    "proposedByRole" "TradeRole",
    "cancelledByRole" "TradeRole",
    "proposedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeParticipant" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "TradeRole" NOT NULL,
    "itemsTotalCents" INTEGER NOT NULL DEFAULT 0,
    "acceptedVersion" INTEGER,
    "completionConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "collectionItemId" UUID,
    "cardId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cardName" VARCHAR(120) NOT NULL,
    "setName" VARCHAR(120) NOT NULL,
    "cardNumber" VARCHAR(32) NOT NULL,
    "variant" VARCHAR(80) NOT NULL,
    "category" "CardCategory" NOT NULL,
    "condition" "CardCondition" NOT NULL,
    "gradingCompany" "GradingCompany",
    "grade" DECIMAL(3,1),
    "priceTierKey" VARCHAR(40) NOT NULL,
    "imageUrl" VARCHAR(500),
    "unitValueCents" INTEGER,
    "valueConfidence" "ValueConfidence" NOT NULL DEFAULT 'NONE',
    "valuedAt" TIMESTAMP(3) NOT NULL,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "tradeId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "reviewedUserId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "CardSet_category_name_idx" ON "CardSet"("category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_category_code_key" ON "CardSet"("category", "code");

-- CreateIndex
CREATE INDEX "Card_category_name_idx" ON "Card"("category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Card_setId_cardNumber_variant_key" ON "Card"("setId", "cardNumber", "variant");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_visibility_idx" ON "CollectionItem"("userId", "visibility");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_createdAt_idx" ON "CollectionItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionItem_cardId_priceTierKey_idx" ON "CollectionItem"("cardId", "priceTierKey");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSource_code_key" ON "PriceSource"("code");

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardId_priceTierKey_soldAt_idx" ON "CardPriceHistory"("cardId", "priceTierKey", "soldAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CardPriceHistory_sourceId_sourceReference_key" ON "CardPriceHistory"("sourceId", "sourceReference");

-- CreateIndex
CREATE INDEX "CardMarketValue_nextRefreshAt_refreshPriority_idx" ON "CardMarketValue"("nextRefreshAt", "refreshPriority");

-- CreateIndex
CREATE UNIQUE INDEX "CardMarketValue_cardId_priceTierKey_key" ON "CardMarketValue"("cardId", "priceTierKey");

-- CreateIndex
CREATE INDEX "Trade_status_updatedAt_idx" ON "Trade"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TradeParticipant_userId_idx" ON "TradeParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeParticipant_tradeId_userId_key" ON "TradeParticipant"("tradeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeParticipant_tradeId_role_key" ON "TradeParticipant"("tradeId", "role");

-- CreateIndex
CREATE INDEX "TradeItem_participantId_idx" ON "TradeItem"("participantId");

-- CreateIndex
CREATE INDEX "TradeItem_collectionItemId_idx" ON "TradeItem"("collectionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeItem_tradeId_collectionItemId_key" ON "TradeItem"("tradeId", "collectionItemId");

-- CreateIndex
CREATE INDEX "Review_reviewedUserId_createdAt_idx" ON "Review"("reviewedUserId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Review_tradeId_reviewerId_key" ON "Review"("tradeId", "reviewerId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPriceHistory" ADD CONSTRAINT "CardPriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPriceHistory" ADD CONSTRAINT "CardPriceHistory_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardMarketValue" ADD CONSTRAINT "CardMarketValue_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardMarketValueDaily" ADD CONSTRAINT "CardMarketValueDaily_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeParticipant" ADD CONSTRAINT "TradeParticipant_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeParticipant" ADD CONSTRAINT "TradeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TradeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

