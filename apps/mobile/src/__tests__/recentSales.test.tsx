import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { CardSummary, MarketValueResponse } from '@card-trader/shared';
import { RecentSales } from '../components/RecentSales';
import { oneThirtyPointQuery, oneThirtyPointUrl } from '../utils/onethirtypoint';

const card: CardSummary = {
  id: 'card-1',
  category: 'SPORTS',
  name: 'Shohei Ohtani',
  cardNumber: '17',
  variant: 'Refractor',
  subject: 'Shohei Ohtani',
  rarity: null,
  imageUrl: null,
  isVerified: true,
  set: { id: 'set-1', category: 'SPORTS', code: 'TC23', name: 'Topps Chrome', year: 2023, manufacturer: 'Topps' },
};

const sale = (id: string, priceCents: number, soldAt: string) => ({ id, priceCents, soldAt, source: 'eBay sold listings', tierKey: 'GRADED:PSA:10', listingTitle: null });

const market: MarketValueResponse = {
  cardId: 'card-1',
  tierKey: 'GRADED:PSA:10',
  tierLabel: 'PSA 10',
  valueCents: 22000,
  confidence: 'HIGH',
  sampleSize: 3,
  lastSaleAt: '2026-10-18T00:00:00Z',
  computedAt: '2026-10-18T00:00:00Z',
  algorithm: 'average-last-3@v1',
  recentSales: [sale('a', 20000, '2026-10-18T12:00:00Z'), sale('b', 21000, '2026-10-16T12:00:00Z'), sale('c', 25000, '2026-10-15T12:00:00Z')],
  disclaimer: 'Estimates only.',
};

describe('130point search', () => {
  it('builds the search from year, set, player, number, parallel and grade', () => {
    expect(oneThirtyPointQuery(card, 'GRADED:PSA:10')).toBe('2023 Topps Chrome Shohei Ohtani #17 Refractor PSA 10');
  });

  it('skips the year when the set name has it, and adds no condition for raw copies', () => {
    const pokemon = { ...card, subject: null, name: 'Charizard', variant: '', set: { ...card.set, name: '2016 Evolutions', year: 2016 } };
    expect(oneThirtyPointQuery(pokemon, 'RAW:NEAR_MINT')).toBe('2016 Evolutions Charizard #17');
  });

  it('links to the 130point sold-listings search', () => {
    expect(oneThirtyPointUrl('Charizard #4 PSA 10')).toBe('https://130point.com/sales/?search=Charizard%20%234%20PSA%2010');
  });
});

describe('RecentSales', () => {
  it('shows the 3 most recent sales and their average as the suggested price', () => {
    render(<RecentSales card={card} tierKey="GRADED:PSA:10" market={market} isPending={false} />);
    expect(screen.getByText('$200')).toBeTruthy();
    expect(screen.getByText('$210')).toBeTruthy();
    expect(screen.getByText('$250')).toBeTruthy();
    expect(screen.getByTestId('suggested-price')).toHaveTextContent(/Suggested price.*Average of the last 3 sales.*\$220/);
  });

  it('opens 130point for this card', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<RecentSales card={card} tierKey="GRADED:PSA:10" market={market} isPending={false} />);
    fireEvent.press(screen.getByText('View sold prices on 130point'));
    expect(open).toHaveBeenCalledWith(oneThirtyPointUrl('2023 Topps Chrome Shohei Ohtani #17 Refractor PSA 10'));
  });

  it('has no suggested price before any sale, but still links to 130point', () => {
    render(<RecentSales card={card} tierKey="RAW" market={{ ...market, valueCents: null, sampleSize: 0, recentSales: [] }} isPending={false} />);
    expect(screen.getByText(/No comparable sales yet/)).toBeTruthy();
    expect(screen.queryByTestId('suggested-price')).toBeNull();
    expect(screen.getByText('View sold prices on 130point')).toBeTruthy();
  });
});
