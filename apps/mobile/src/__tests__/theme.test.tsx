import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ScreenBackground } from '../components/ScreenBackground';
import { ThemeSelector } from '../features/profile/ThemeSelector';
import { darkTheme, hydrateThemeMode, makeStyles, purpleTheme, THEME_MODES, themes, useTheme, useThemeMode } from '../theme';

const setMode = (mode: 'purple' | 'dark') => {
  const { result } = renderHook(() => useThemeMode());
  act(() => result.current.setMode(mode));
};

describe('theme system', () => {
  afterEach(() => setMode('purple'));

  it('defines every token in every theme', () => {
    const keys = Object.keys(purpleTheme.colors).sort();
    for (const mode of THEME_MODES) {
      expect(Object.keys(themes[mode].colors).sort()).toEqual(keys);
      expect(Object.values(themes[mode].colors).every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    }
    expect(purpleTheme.dark).toBe(false);
    expect(darkTheme.dark).toBe(true);
  });

  it('keeps text, buttons and status colors readable in every theme (WCAG AA)', () => {
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255]
        .map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    // [foreground, background, minimum]: 4.5 for body text, 3 for large/bold text and icons.
    const pairs = [
      ['text', 'background', 4.5],
      ['text', 'surface', 4.5],
      ['text', 'inputBackground', 4.5],
      ['textMuted', 'surface', 4.5],
      ['textMuted', 'background', 4.5],
      ['textSubtle', 'surface', 3],
      ['primary', 'surface', 3],
      ['primary', 'primarySoft', 3],
      ['onPrimary', 'primary', 4.5],
      ['positive', 'positiveSoft', 3],
      ['negative', 'negativeSoft', 3],
      ['warning', 'warningSoft', 3],
    ] as const;
    for (const mode of THEME_MODES) {
      const colors = themes[mode].colors;
      for (const [fg, bg, min] of pairs) {
        expect({ mode, pair: `${fg} on ${bg}`, ok: contrast(colors[fg], colors[bg]) >= min }).toEqual({ mode, pair: `${fg} on ${bg}`, ok: true });
      }
    }
  });

  it('Purple Mode draws a gradient behind screens that text stays readable on; Dark Mode draws none', () => {
    render(<ScreenBackground />);
    const gradient = screen.getByTestId('screen-gradient');
    expect(gradient).toBeTruthy();
    const [top, bottom] = purpleTheme.backgroundGradient!;
    // react-native-svg stores stop colors as packed signed ARGB integers.
    const argb = (hex: string) => (0xff000000 | parseInt(hex.slice(1), 16)) | 0;
    expect(JSON.stringify(screen.toJSON())).toEqual(expect.stringContaining(`"gradient":[0,${argb(top)},1,${argb(bottom)}]`));
    expect(bottom).toBe(purpleTheme.colors.background);

    setMode('dark');
    render(<ScreenBackground />);
    expect(screen.queryByTestId('screen-gradient')).toBeNull();
    expect(darkTheme.backgroundGradient).toBeNull();
  });

  it('switches every consumer when a mode is picked in the selector, and saves the choice', () => {
    render(
      <>
        <ThemeSelector />
        <AppText>Sample</AppText>
        <Button title="Save" onPress={() => undefined} />
      </>,
    );
    expect(screen.getByText('Sample')).toHaveStyle({ color: purpleTheme.colors.text });
    expect(screen.getByLabelText('Purple Mode')).toHaveProp('accessibilityState', { checked: true });

    fireEvent.press(screen.getByTestId('theme-option-dark'));

    expect(screen.getByText('Sample')).toHaveStyle({ color: darkTheme.colors.text });
    expect(screen.getByText('Save')).toHaveStyle({ color: darkTheme.colors.onPrimary });
    expect(screen.getByLabelText('Dark Mode')).toHaveProp('accessibilityState', { checked: true });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ct.themeMode', 'dark');

    fireEvent.press(screen.getByTestId('theme-option-purple'));
    expect(screen.getByText('Sample')).toHaveStyle({ color: purpleTheme.colors.text });
  });

  it('restores the saved mode on the next launch and ignores unknown values', async () => {
    await SecureStore.setItemAsync('ct.themeMode', 'dark');
    await act(() => hydrateThemeMode());
    expect(renderHook(() => useTheme()).result.current.mode).toBe('dark');
    expect(renderHook(() => useThemeMode()).result.current.hydrated).toBe(true);

    setMode('purple');
    await SecureStore.setItemAsync('ct.themeMode', 'neon');
    await act(() => hydrateThemeMode());
    expect(renderHook(() => useTheme()).result.current.mode).toBe('purple');
  });

  it('builds each theme’s stylesheet once and reuses it', () => {
    const factory = jest.fn(({ colors }: typeof purpleTheme) => ({ box: { backgroundColor: colors.surface } }));
    const useStyles = makeStyles(factory);

    const { result, rerender } = renderHook(() => useStyles());
    const purpleStyles = result.current;
    expect(purpleStyles.box).toEqual({ backgroundColor: purpleTheme.colors.surface });
    rerender({});
    expect(result.current).toBe(purpleStyles);

    setMode('dark');
    rerender({});
    expect(result.current.box).toEqual({ backgroundColor: darkTheme.colors.surface });

    setMode('purple');
    rerender({});
    expect(result.current).toBe(purpleStyles);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
