import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { fontSize, layout, radius, sizes } from '../theme/tokens';
import type { Resource } from '../domain/resource';
import { Donut } from './Donut';
import { AppText, MonoText, type TextTone } from './Text';

export interface PartRowProps {
  name: string;
  /** Остаток ресурса словами: «7 400 км · 8 мес» либо «нет данных». */
  subtitle: string;
  subtitleTone?: TextTone;
  resource: Resource;
  onPress?: () => void;
}

export function PartRow({
  name,
  subtitle,
  subtitleTone = 'secondary',
  resource,
  onPress,
}: PartRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <Donut size={sizes.donutSm} value={resource.value} status={resource.status} />
      <View style={styles.column}>
        <AppText variant="bodyMedium" numberOfLines={2}>
          {name}
        </AppText>
        <MonoText tone={subtitleTone} size={fontSize.partSubtitle}>
          {subtitle}
        </MonoText>
      </View>
      <ChevronRight size={sizes.iconSm} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: layout.partRow.gap,
    minHeight: sizes.partRowHeight,
    paddingHorizontal: layout.partRow.paddingHorizontal,
    paddingVertical: layout.partRow.paddingVertical,
  },
  column: {
    flex: 1,
    gap: layout.partRow.textGap,
  },
});
