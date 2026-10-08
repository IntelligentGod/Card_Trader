import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

/**
 * The theme's screen gradient, filling the parent. Place it as the first child of a
 * screen's root container (which must be `flex: 1`); themes without a gradient render nothing
 * and keep the container's solid `colors.background`.
 */
export function ScreenBackground() {
  const { backgroundGradient } = useTheme();
  if (!backgroundGradient) return null;
  const [top, bottom] = backgroundGradient;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none" testID="screen-gradient">
      <Defs>
        <LinearGradient id="screen-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect width="1" height="1" fill="url(#screen-bg)" />
    </Svg>
  );
}
