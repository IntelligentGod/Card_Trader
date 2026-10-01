-- Database-level guarantees Prisma cannot express. The services enforce the
-- same rules; these constraints are the last line of defence.

-- Fuzzy catalog search (ILIKE '%q%') via trigram indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Card_name_trgm_idx" ON "Card" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Card_subject_trgm_idx" ON "Card" USING GIN ("subject" gin_trgm_ops);
CREATE INDEX "CardSet_name_trgm_idx" ON "CardSet" USING GIN ("name" gin_trgm_ops);

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_counters_nonnegative"
    CHECK ("ratingSum" >= 0 AND "ratingCount" >= 0 AND "completedTradeCount" >= 0);

ALTER TABLE "CollectionItem"
  ADD CONSTRAINT "CollectionItem_quantity_range" CHECK ("quantity" BETWEEN 1 AND 999),
  ADD CONSTRAINT "CollectionItem_grading_consistent"
    CHECK (("condition" = 'GRADED') = ("gradingCompany" IS NOT NULL AND "grade" IS NOT NULL)),
  ADD CONSTRAINT "CollectionItem_grade_range" CHECK ("grade" IS NULL OR "grade" BETWEEN 1 AND 10),
  ADD CONSTRAINT "CollectionItem_graded_single_copy" CHECK ("condition" <> 'GRADED' OR "quantity" = 1),
  ADD CONSTRAINT "CollectionItem_money_nonnegative"
    CHECK (("purchasePriceCents" IS NULL OR "purchasePriceCents" >= 0)
       AND ("estimatedValueCents" IS NULL OR "estimatedValueCents" >= 0));

ALTER TABLE "CardPriceHistory"
  ADD CONSTRAINT "CardPriceHistory_price_positive" CHECK ("priceCents" > 0),
  ADD CONSTRAINT "CardPriceHistory_grading_consistent"
    CHECK (("condition" = 'GRADED') = ("gradingCompany" IS NOT NULL AND "grade" IS NOT NULL));

ALTER TABLE "CardMarketValue"
  ADD CONSTRAINT "CardMarketValue_value_nonnegative" CHECK ("valueCents" IS NULL OR "valueCents" >= 0);

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "Trade_cash_nonnegative" CHECK ("agreedCashCents" >= 0 AND "suggestedCashCents" >= 0),
  ADD CONSTRAINT "Trade_cash_payer_consistent" CHECK (("agreedCashCents" = 0) = ("agreedCashPayer" IS NULL));

ALTER TABLE "TradeItem"
  ADD CONSTRAINT "TradeItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "TradeItem_values_nonnegative"
    CHECK (("unitValueCents" IS NULL OR "unitValueCents" >= 0) AND "lineTotalCents" >= 0);

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_not_self" CHECK ("reviewerId" <> "reviewedUserId");
