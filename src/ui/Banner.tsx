import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Info, TriangleAlert } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { fontSize, layout, lineHeight, radius, sizes } from '../theme/tokens';
import { AppText } from './Text';

export type BannerTone = 'info' | 'warning';

export interface BannerProps {
  text: string;
  tone?: BannerTone;
  style?: StyleProp<ViewStyle>;
}

export function Banner({ text, tone = 'info', style }: BannerProps) {
  const colors = useColors();
  const info = tone === 'info';
  const Icon = info ? Info : TriangleAlert;
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: info ? colors.accentSoft : colors.warnSoft },
        style,
      ]}
    >
      <Icon size={sizes.iconMd} color={info ? colors.accent : colors.warn} />
      <AppText tone="secondary" style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: layout.banner.gap,
    padding: layout.banner.padding,
  },
  text: {
    flex: 1,
    fontSize: fontSize.banner,
    lineHeight: fontSize.banner * lineHeight.relaxed,
  },
});
