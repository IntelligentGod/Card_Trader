import { act, render, renderHook, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { ScreenBackground } from '../components/ScreenBackground';
import { hydrateThemeMode, makeStyles, purpleTheme, THEME_MODES, themes, useTheme, useThemeMode } from '../theme';

describe('theme system', () => {
  it('defines every token in every theme', () => {
    const keys = Object.keys(purpleTheme.colors).sort();
    for (const mode of THEME_MODES) {
      expect(Object.keys(themes[mode].colors).sort()).toEqual(keys);
      expect(Object.values(themes[mode].colors).every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    }
    expect(THEME_MODES).toEqual(['purple']);
    expect(purpleTheme.dark).toBe(false);
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

  it('draws the light purple gradient behind screens, ending in the background color text is checked against', () => {
    render(<ScreenBackground />);
    const gradient = screen.getByTestId('screen-gradient');
    expect(gradient).toBeTruthy();
    const [top, bottom] = purpleTheme.backgroundGradient!;
    // react-native-svg stores stop colors as packed signed ARGB integers.
    const argb = (hex: string) => (0xff000000 | parseInt(hex.slice(1), 16)) | 0;
    expect(JSON.stringify(screen.toJSON())).toEqual(expect.stringContaining(`"gradient":[0,${argb(top)},1,${argb(bottom)}]`));
    expect(bottom).toBe(purpleTheme.colors.background);
  });

  it('starts in the light purple theme even if an older version saved Dark Mode', async () => {
    await SecureStore.setItemAsync('ct.themeMode', 'dark');
    await act(() => hydrateThemeMode());
    expect(renderHook(() => useTheme()).result.current.mode).toBe('purple');
    expect(renderHook(() => useThemeMode()).result.current.hydrated).toBe(true);
  });

  it('builds the stylesheet once and reuses it', () => {
    const factory = jest.fn(({ colors }: typeof purpleTheme) => ({ box: { backgroundColor: colors.surface } }));
    const useStyles = makeStyles(factory);

    const { result, rerender } = renderHook(() => useStyles());
    const styles = result.current;
    expect(styles.box).toEqual({ backgroundColor: purpleTheme.colors.surface });
    rerender({});
    expect(result.current).toBe(styles);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
