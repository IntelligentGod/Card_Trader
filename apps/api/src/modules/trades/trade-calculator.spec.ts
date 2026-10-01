import { calculateTrade, effectiveCash, finalValue } from './trade-calculator';

const line = (dollars: number | null, quantity = 1) => ({
  unitValueCents: dollars === null ? null : dollars * 100,
  quantity,
});

describe('calculateTrade', () => {
  it('matches the spec example: $300 vs $280 → counterparty adds $20', () => {
    const result = calculateTrade([line(220), line(80)], [line(250), line(30)]);
    expect(result).toEqual({
      initiatorTotalCents: 30000,
      counterpartyTotalCents: 28000,
      differenceCents: 2000,
      suggestedCashPayer: 'COUNTERPARTY',
      suggestedCashCents: 2000,
      hasUnpricedItems: false,
    });
  });

  it('asks the initiator to pay when their side is lower', () => {
    const result = calculateTrade([line(50)], [line(75)]);
    expect(result.differenceCents).toBe(-2500);
    expect(result.suggestedCashPayer).toBe('INITIATOR');
    expect(result.suggestedCashCents).toBe(2500);
  });

  it('is balanced at zero difference', () => {
    const result = calculateTrade([line(100)], [line(60), line(40)]);
    expect(result.suggestedCashPayer).toBeNull();
    expect(result.suggestedCashCents).toBe(0);
  });

  it('multiplies by quantity and treats unpriced cards as $0 while flagging them', () => {
    const result = calculateTrade([line(10, 3)], [line(null)]);
    expect(result.initiatorTotalCents).toBe(3000);
    expect(result.counterpartyTotalCents).toBe(0);
    expect(result.hasUnpricedItems).toBe(true);
  });

  it('handles empty sides', () => {
    expect(calculateTrade([], []).differenceCents).toBe(0);
  });
});

describe('effectiveCash / finalValue', () => {
  const calc = calculateTrade([line(300)], [line(280)]);

  it('uses the suggestion unless a manual amount was agreed', () => {
    expect(effectiveCash(calc, { isManual: false, payer: null, amountCents: 0 })).toEqual({
      payer: 'COUNTERPARTY',
      amountCents: 2000,
      isManual: false,
    });
    expect(effectiveCash(calc, { isManual: true, payer: 'COUNTERPARTY', amountCents: 1500 })).toEqual({
      payer: 'COUNTERPARTY',
      amountCents: 1500,
      isManual: true,
    });
    expect(effectiveCash(calc, { isManual: true, payer: 'INITIATOR', amountCents: 0 }).payer).toBeNull();
  });

  it('adds cash to the paying side', () => {
    const cash = effectiveCash(calc, { isManual: false, payer: null, amountCents: 0 });
    expect(finalValue(calc, cash)).toEqual({ initiatorGivesCents: 30000, counterpartyGivesCents: 30000 });
  });
});
