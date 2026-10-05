import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';

const QUIET_ZONE = 4;

/** Converts QR modules to a single SVG path (fast to render, crisp at any size). */
export function qrPath(value: string): { path: string; size: number } {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) path += `M${col + QUIET_ZONE},${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { path, size: size + QUIET_ZONE * 2 };
}

export function QRCodeView({ value, size = 240, label = 'Your trade QR code' }: { value: string; size?: number; label?: string }) {
  const { colors } = useTheme();
  const { path, size: modules } = useMemo(() => qrPath(value), [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} accessibilityLabel={label}>
      <Rect x={0} y={0} width={modules} height={modules} fill={colors.white} />
      <Path d={path} fill={colors.text} />
    </Svg>
  );
}
