import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../components/Button';
import { EventCard } from '../components/EventCard';
import { ListingBadge } from '../components/ListingBadge';
import { VerifiedTradeBadge } from '../components/Profile';
import { PriceText } from '../components/PriceText';
import { EmptyState } from '../components/States';
import { TrendBadge } from '../components/TrendBadge';
import { colors } from '../theme';

describe('PriceText', () => {
  it('formats cents and shows a placeholder without an estimate', () => {
    render(<PriceText cents={842000} testID="price" />);
    expect(screen.getByTestId('price')).toHaveTextContent('$8,420');
    render(<PriceText cents={null} testID="none" />);
    expect(screen.getByTestId('none')).toHaveTextContent('No estimate');
  });
});

describe('TrendBadge', () => {
  it('renders green for gains and red for losses', () => {
    const { rerender } = render(<TrendBadge amountCents={64000} percent={8.2} suffix="30d" />);
    expect(screen.getByText('+$640 · +8.2% 30d')).toHaveStyle({ color: colors.positive });
    rerender(<TrendBadge amountCents={-2000} percent={-1.5} />);
    expect(screen.getByText('-$20 · -1.5%')).toHaveStyle({ color: colors.negative });
  });
});

describe('Button', () => {
  it('calls onPress and is disabled while loading', () => {
    const onPress = jest.fn();
    const { rerender } = render(<Button title="Send offer" onPress={onPress} testID="btn" />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<Button title="Send offer" onPress={onPress} testID="btn" loading />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('shows an action when provided', () => {
    const onAction = jest.fn();
    render(<EmptyState title="Start your collection" actionTitle="Add a card" onAction={onAction} />);
    fireEvent.press(screen.getByText('Add a card'));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('ListingBadge', () => {
  it('shows status with asking price and hides personal cards', () => {
    render(<ListingBadge status="TRADE_AND_SALE" askingPriceCents={4500} />);
    expect(screen.getByText('Trade + sale · $45')).toBeTruthy();
    render(<ListingBadge status="PERSONAL" />);
    expect(screen.queryByText('Personal collection')).toBeNull();
  });
});

describe('EventCard', () => {
  it('shows the show, vendor count and my vendor status', () => {
    const onPress = jest.fn();
    render(
      <EventCard
        onPress={onPress}
        event={{
          id: 'e1',
          title: 'Austin Card Show',
          status: 'PUBLISHED',
          startsAt: '2030-11-14T15:00:00.000Z',
          endsAt: '2030-11-14T23:00:00.000Z',
          venueName: 'Palmer Events Center',
          city: 'Austin',
          region: 'TX',
          admission: '$10',
          organizerDisplayName: 'Texas Card Shows',
          approvedVendorCount: 12,
          isSaved: true,
          isOrganizer: false,
          myVendorStatus: 'APPROVED',
        }}
      />,
    );
    expect(screen.getByText('Austin Card Show')).toBeTruthy();
    expect(screen.getByText('12 vendors · $10')).toBeTruthy();
    expect(screen.getByText('Vendor · Approved')).toBeTruthy();
    fireEvent.press(screen.getByText('Austin Card Show'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('VerifiedTradeBadge', () => {
  it('labels reviews from completed trades', () => {
    render(<VerifiedTradeBadge />);
    expect(screen.getByText('Verified Trade')).toBeTruthy();
  });
});
