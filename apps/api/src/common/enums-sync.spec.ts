import * as Prisma from '@prisma/client';
import * as Shared from '@card-trader/shared';

/** The shared package mirrors Prisma enums by hand; this keeps them in lockstep. */
describe('shared enums match Prisma enums', () => {
  const pairs: Array<[string, Record<string, string>, Record<string, string>]> = [
    ['UserStatus', Prisma.UserStatus, Shared.UserStatus],
    ['UserRole', Prisma.UserRole, Shared.UserRole],
    ['CardCategory', Prisma.CardCategory, Shared.CardCategory],
    ['CardCondition', Prisma.CardCondition, Shared.CardCondition],
    ['GradingCompany', Prisma.GradingCompany, Shared.GradingCompany],
    ['ListingStatus', Prisma.ListingStatus, Shared.ListingStatus],
    ['CatalogSource', Prisma.CatalogSource, Shared.CatalogSource],
    ['ValueConfidence', Prisma.ValueConfidence, Shared.ValueConfidence],
    ['TradeStatus', Prisma.TradeStatus, Shared.TradeStatus],
    ['TradeRole', Prisma.TradeRole, Shared.TradeRole],
    ['EventStatus', Prisma.EventStatus, Shared.EventStatus],
    ['VendorApplicationStatus', Prisma.VendorApplicationStatus, Shared.VendorApplicationStatus],
    ['NotificationType', Prisma.NotificationType, Shared.NotificationType],
  ];

  it.each(pairs)('%s', (_name, prismaEnum, sharedEnum) => {
    expect(Object.values(sharedEnum).sort()).toEqual(Object.values(prismaEnum).sort());
  });
});
