import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, sizes } from '../theme/tokens';

export type IconButtonVariant = 'plain' | 'soft';

export interface IconButtonProps {
  icon: LucideIcon;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon: Icon,
  onPress,
  variant = 'plain',
  size = sizes.iconLg,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const colors = useColors();
  const soft = variant === 'soft';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        soft && { backgroundColor: colors.accentSoft },
        { opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Icon size={size} color={soft ? colors.accent : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
});
