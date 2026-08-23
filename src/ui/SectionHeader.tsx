import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { sizes } from '../theme/tokens';
import { AppText } from './Text';

export interface SectionHeaderProps {
  title: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  collapsible = false,
  collapsed = false,
  onToggle,
  style,
}: SectionHeaderProps) {
  const colors = useColors();
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  const label = (
    <AppText variant="sectionLabel" numberOfLines={1}>
      {title}
    </AppText>
  );

  if (!collapsible) {
    return <View style={[styles.header, style]}>{label}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      onPress={onToggle}
      style={({ pressed }) => [styles.header, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {label}
      <Chevron size={sizes.iconSm} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
