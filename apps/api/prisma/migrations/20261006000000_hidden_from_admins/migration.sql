-- Accounts hidden from every other admin in the admin console (the owner account).
ALTER TABLE "User" ADD COLUMN "hiddenFromAdmins" BOOLEAN NOT NULL DEFAULT false;
