-- App-wide admin actions (announcements) are audited against SYSTEM.
ALTER TYPE "AdminTargetType" ADD VALUE 'SYSTEM';
