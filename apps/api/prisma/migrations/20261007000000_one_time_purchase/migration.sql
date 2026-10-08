-- One-time "full access" purchase (Google Play / App Store through RevenueCat) or an admin grant.
ALTER TABLE "User" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "paidVia" VARCHAR(20);
