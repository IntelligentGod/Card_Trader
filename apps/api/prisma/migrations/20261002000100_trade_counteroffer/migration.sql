-- A counteroffer is an offer sent by the other side than the previous offer.
-- proposedByRole is cleared by every edit, so the last sender is kept separately.
ALTER TABLE "Trade"
  ADD COLUMN "lastProposedByRole" "TradeRole",
  ADD COLUMN "isCounterOffer" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Trade" SET "lastProposedByRole" = "proposedByRole" WHERE "proposedByRole" IS NOT NULL;
