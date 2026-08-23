import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, sizes } from '../theme/tokens';
import type { ResourceStatus } from '../domain/resource';

export interface ProgressBarProps {
  /** 0..100 — доля заполнения полосы. */
  value: number;
  status: ResourceStatus;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ value, status, style }: ProgressBarProps) {
  const colors = useColors();
  const filled = Math.max(0, Math.min(100, value));
  const fillColor =
    status === 'ok'
      ? colors.ok
      : status === 'warn'
        ? colors.warn
        : status === 'overdue'
          ? colors.danger
          : colors.muted;

  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }, style]}>
      <View style={[styles.fill, { backgroundColor: fillColor, width: `${filled}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.xs,
    height: sizes.progressHeight,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.xs,
    height: '100%',
  },
});
