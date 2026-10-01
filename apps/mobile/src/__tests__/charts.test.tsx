import { fireEvent, render, screen } from '@testing-library/react-native';
import { CATEGORY_SLOT, chartData } from '../features/admin/chartGeometry';
import { BarChart, PieChart } from '../features/admin/charts';

const labels = { POKEMON: 'Pokémon', ONE_PIECE: 'One Piece', SPORTS: 'Sports' };
const keys = ['POKEMON', 'ONE_PIECE', 'SPORTS'] as const;

describe('PieChart', () => {
  it('shows a legend with values and a table with the same numbers', () => {
    render(<PieChart title="By category" data={chartData({ POKEMON: 50, ONE_PIECE: 30, SPORTS: 20 }, keys, labels, CATEGORY_SLOT)} />);
    expect(screen.getByLabelText('By category: Pokémon 50 (50%), One Piece 30 (30%), Sports 20 (20%)')).toBeTruthy();
    fireEvent.press(screen.getByText('One Piece'));
    expect(screen.getByText('One Piece: 30 · 30%')).toBeTruthy();
    fireEvent.press(screen.getByText('Show as table'));
    expect(screen.getByTestId('chart-table')).toBeTruthy();
    expect(screen.getByText('Show as chart')).toBeTruthy();
  });

  it('falls back to stat tiles with fewer than 3 non-zero parts', () => {
    render(<PieChart title="By category" data={chartData({ POKEMON: 5, ONE_PIECE: 0, SPORTS: 0 }, keys, labels, CATEGORY_SLOT)} />);
    expect(screen.queryByText('Show as table')).toBeNull();
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

describe('BarChart', () => {
  it('summarises the series for screen readers and offers a table', () => {
    render(
      <BarChart
        title="Sign-ups per month"
        points={[
          { month: '2026-08', value: 3 },
          { month: '2026-09', value: 7 },
        ]}
      />,
    );
    expect(screen.getByLabelText('Sign-ups per month, Aug 2026 to Sep 2026: total 10, latest 7')).toBeTruthy();
    fireEvent.press(screen.getByText('Show as table'));
    expect(screen.getByText('Sep 2026')).toBeTruthy();
  });
});
