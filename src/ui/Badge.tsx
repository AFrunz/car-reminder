import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, radius } from '../theme/tokens';
import { AppText } from './Text';

export type BadgeTone = 'accent' | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'accent', style }: BadgeProps) {
  const colors = useColors();
  const accent = tone === 'accent';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: accent ? colors.accentSoft : colors.surfaceAlt },
        style,
      ]}
    >
      <AppText tone={accent ? 'accent' : 'secondary'} style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: layout.badge.paddingHorizontal,
    paddingVertical: layout.badge.paddingVertical,
  },
  label: {
    fontFamily: fonts.uiSemibold,
    fontSize: fontSize.badge,
  },
});
