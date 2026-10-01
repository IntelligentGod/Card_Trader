import { adminCashText, eventRelationText, gradeText, USER_ROLE_LABELS, USER_STATUS_LABELS } from '../features/admin/adminText';

describe('admin cash text', () => {
  it('names who pays whom, neutrally', () => {
    expect(adminCashText({ payer: 'COUNTERPARTY', amountCents: 2000, isManual: false }, 'Tom', 'Bob')).toBe('Bob pays Tom $20');
    expect(adminCashText({ payer: 'INITIATOR', amountCents: 1550, isManual: true }, 'Tom', 'Bob')).toBe('Tom pays Bob $15.50 (agreed)');
  });

  it('handles no cash', () => {
    expect(adminCashText({ payer: null, amountCents: 0, isManual: false }, 'Tom', 'Bob')).toBe('No cash');
    expect(adminCashText({ payer: 'INITIATOR', amountCents: 0, isManual: true }, 'Tom', 'Bob')).toBe('No cash (agreed)');
  });
});

describe('admin labels', () => {
  it('labels roles, statuses, grades and event relations', () => {
    expect(USER_ROLE_LABELS.ADMIN).toBe('Admin');
    expect(USER_ROLE_LABELS.SUPER_ADMIN).toBe('Super admin');
    expect(USER_STATUS_LABELS.BLOCKED).toBe('Blocked');
    expect(USER_STATUS_LABELS.DISABLED).toBe('Disabled');
    expect(gradeText({ condition: 'GRADED', gradingCompany: 'PSA', grade: 10 })).toBe('PSA 10');
    expect(gradeText({ condition: 'NEAR_MINT', gradingCompany: null, grade: null })).toBe('Near Mint');
    const event = { id: 'e1', title: 'Show', status: 'PUBLISHED', startsAt: '2030-11-14T15:00:00.000Z' } as const;
    expect(eventRelationText({ ...event, relation: 'VENDOR', vendorStatus: 'APPROVED', tableNumber: '12' })).toBe('Vendor · Approved · Table 12');
    expect(eventRelationText({ ...event, relation: 'ORGANIZER', vendorStatus: null, tableNumber: null })).toBe('Organizer');
    expect(eventRelationText({ ...event, relation: 'SAVED', vendorStatus: null, tableNumber: null })).toBe('Interested');
  });
});
