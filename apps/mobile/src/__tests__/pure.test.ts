import { buildChartGeometry } from '../components/LineChart';
import { qrPath } from '../components/QRCodeView';
import { normalizeUsername, validateLogin, validateRegister } from '../features/auth/validation';
import { validateItemForm } from '../features/collection/components/CollectionItemForm';
import { toIsoInstant, validateEventForm } from '../features/events/screens/EventEditScreen';
import { toSearchQuery } from '../features/events/screens/EventSearchScreen';
import { notificationTarget } from '../features/notifications/hooks';
import { cleanSocialLinks, socialLinkErrors } from '../features/profile/SocialLinksFields';
import { interpretScan } from '../features/qr/scan';
import { socialUrl } from '../components/Social';

describe('interpretScan', () => {
  it('accepts only our deep link', () => {
    expect(interpretScan('cardtrader://u/AbCdEfGhIjKl', 'mine12345678')).toEqual({ kind: 'user', publicId: 'AbCdEfGhIjKl' });
    expect(interpretScan('https://example.com/u/AbCdEfGhIjKl', undefined)).toEqual({ kind: 'invalid' });
    expect(interpretScan('WIFI:S:show;T:WPA;P:secret;;', undefined)).toEqual({ kind: 'invalid' });
    expect(interpretScan('cardtrader://u/mine12345678', 'mine12345678')).toEqual({ kind: 'self' });
  });
});

describe('auth validation', () => {
  it('validates login and registration', () => {
    expect(validateLogin('bad', '')).toEqual({ email: expect.any(String), password: expect.any(String) });
    expect(validateLogin('tom@example.com', 'x')).toEqual({});
    expect(validateRegister('tom@example.com', 'short', 'T')).toEqual({ password: expect.any(String), displayName: expect.any(String) });
    expect(validateRegister('tom@example.com', 'long-enough-pass', 'Tom', 'no spaces')).toEqual({ username: expect.any(String) });
    expect(validateRegister('tom@example.com', 'long-enough-pass', 'Tom', '@Tom_Cards')).toEqual({});
    expect(normalizeUsername('  @Tom_Cards ')).toBe('tom_cards');
  });
});

describe('collection item form validation', () => {
  const base = { condition: 'NEAR_MINT' as const, gradingCompany: undefined, grade: '', quantity: '1', price: '', date: '' };

  it('requires company + valid grade for graded cards', () => {
    expect(validateItemForm({ ...base, condition: 'GRADED' }).errors.grade).toBeDefined();
    expect(validateItemForm({ ...base, condition: 'GRADED', gradingCompany: 'PSA', grade: '9.3' }).errors.grade).toBeDefined();
    const ok = validateItemForm({ ...base, condition: 'GRADED', gradingCompany: 'BGS', grade: '9.5' });
    expect(ok.values).toMatchObject({ condition: 'GRADED', gradingCompany: 'BGS', grade: 9.5, quantity: 1 });
  });

  it('never sends grading fields for raw cards and parses money to cents', () => {
    const result = validateItemForm({ ...base, gradingCompany: 'PSA', grade: '10', quantity: '3', price: '$1,250.50' });
    expect(result.values).toMatchObject({ gradingCompany: null, grade: null, quantity: 3, purchasePriceCents: 125050 });
  });

  it('rejects bad quantity, price, and date', () => {
    const { errors } = validateItemForm({ ...base, quantity: '0', price: '12.345', date: '09/01/2025' });
    expect(Object.keys(errors).sort()).toEqual(['date', 'price', 'quantity']);
  });

  it('keeps an asking price only for cards that are for sale', () => {
    const forSale = validateItemForm({ ...base, listingStatus: 'FOR_SALE', askingPrice: '45' });
    expect(forSale.values).toMatchObject({ listingStatus: 'FOR_SALE', askingPriceCents: 4500 });
    const forTrade = validateItemForm({ ...base, listingStatus: 'FOR_TRADE', askingPrice: '45' });
    expect(forTrade.values).toMatchObject({ listingStatus: 'FOR_TRADE', askingPriceCents: null });
    expect(validateItemForm({ ...base, listingStatus: 'TRADE_AND_SALE', askingPrice: 'abc' }).errors.asking).toBeDefined();
    expect(validateItemForm(base).values?.listingStatus).toBe('PERSONAL');
  });
});

describe('chart geometry', () => {
  it('scales points into the box and detects direction', () => {
    const g = buildChartGeometry(
      [
        { date: '2026-09-01', valueCents: 100 },
        { date: '2026-09-02', valueCents: 300 },
        { date: '2026-09-03', valueCents: 200 },
      ],
      200,
      100,
    )!;
    expect(g.coords[0]!.x).toBe(0);
    expect(g.coords[2]!.x).toBe(200);
    expect(g.coords[1]!.y).toBeLessThan(g.coords[0]!.y); // higher value = higher on screen
    expect(g.rising).toBe(true);
    expect(g.line.startsWith('M0.0,')).toBe(true);
  });

  it('needs at least two points', () => {
    expect(buildChartGeometry([{ date: '2026-09-01', valueCents: 1 }], 100, 100)).toBeNull();
  });
});

describe('qrPath', () => {
  it('encodes the deep link as square modules with a quiet zone', () => {
    const { path, size } = qrPath('cardtrader://u/AbCdEfGhIjKl');
    expect(size).toBeGreaterThanOrEqual(21 + 8);
    expect(path).toMatch(/^M\d+,\d+h1v1h-1z/);
  });
});

describe('event form validation', () => {
  const form = {
    title: 'Austin Card Show',
    date: '2030-11-14',
    startTime: '09:00',
    endDate: '',
    endTime: '17:00',
    venueName: 'Palmer Events Center',
    address: '',
    city: 'Austin',
    region: 'TX',
    admission: '$10',
    organizerName: '',
    website: '',
    instagram: '@txshows',
    facebook: '',
    description: '',
  };

  it('builds ISO start/end instants and drops empty optional fields', () => {
    const { errors, values } = validateEventForm(form);
    expect(errors).toEqual({});
    expect(values).toMatchObject({ title: 'Austin Card Show', city: 'Austin', address: null, socialLinks: { instagram: '@txshows' } });
    expect(new Date(values!.endsAt).getTime() - new Date(values!.startsAt).getTime()).toBe(8 * 3_600_000);
  });

  it('rejects bad dates, backwards times and partial links', () => {
    expect(validateEventForm({ ...form, date: '11/14/2030' }).errors.date).toBeDefined();
    expect(validateEventForm({ ...form, endTime: '08:00' }).errors.endTime).toBeDefined();
    expect(validateEventForm({ ...form, website: 'example.com' }).errors.website).toBeDefined();
    expect(toIsoInstant('2030-01-01', '25:00')).toBeNull();
  });
});

describe('Search This Event filters', () => {
  const input = {
    q: ' zoro ',
    set: '',
    year: '19',
    kind: 'GRADED' as const,
    grader: 'PSA' as const,
    grade: '10',
    condition: 'MINT' as const,
    minPrice: '10',
    maxPrice: '',
    forSale: true,
    forTrade: false,
  };

  it('sends only meaningful, consistent filters', () => {
    expect(toSearchQuery(input)).toEqual({ q: 'zoro', kind: 'GRADED', grader: 'PSA', grade: 10, minPriceCents: 1000, forSale: true });
    expect(toSearchQuery({ ...input, kind: 'RAW' })).toEqual({ q: 'zoro', kind: 'RAW', condition: 'MINT', minPriceCents: 1000, forSale: true });
  });
});

describe('social links', () => {
  it('accepts handles and http(s) links only', () => {
    expect(socialLinkErrors({ instagram: '@shop', website: 'https://shop.example.com' })).toEqual({});
    expect(Object.keys(socialLinkErrors({ instagram: 'not a handle', website: 'javascript:alert(1)' })).sort()).toEqual(['instagram', 'website']);
    expect(cleanSocialLinks({ instagram: ' @shop ', x: '  ' })).toEqual({ instagram: '@shop' });
    expect(socialUrl('instagram', '@shop')).toBe('https://instagram.com/shop');
    expect(socialUrl('website', 'https://shop.example.com')).toBe('https://shop.example.com');
  });
});

describe('notification routing', () => {
  it('opens the trade, the event, or the organizer vendor list', () => {
    expect(notificationTarget('TRADE_COUNTER', { tradeId: 't1' })).toEqual(['TradeConfirmation', { tradeId: 't1' }]);
    expect(notificationTarget('TRADE_TERMS_CHANGED', { tradeId: 't1' })).toEqual(['TradeBuilder', { tradeId: 't1' }]);
    expect(notificationTarget('VENDOR_APPLICATION', { eventId: 'e1' })).toEqual(['EventVendors', { eventId: 'e1' }]);
    expect(notificationTarget('EVENT_REMINDER', { eventId: 'e1' })).toEqual(['EventDetails', { eventId: 'e1' }]);
    expect(notificationTarget('EVENT_UPDATED', {})).toBeNull();
  });
});
