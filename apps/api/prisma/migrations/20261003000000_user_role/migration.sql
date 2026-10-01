-- Admins can read every account, collection and trade. Everyone starts as USER;
-- grant with: npm run admin:grant -w @card-trader/api -- <email>
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
