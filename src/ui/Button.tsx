import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, radius, sizes } from '../theme/tokens';
import { AppText } from './Text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  icon?: LucideIcon;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  icon: Icon,
  fullWidth = false,
  disabled = false,
  style,
}: ButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        { backgroundColor: colors.accent, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {Icon ? <Icon size={sizes.iconMd} color={colors.onAccent} /> : null}
      <AppText style={[styles.label, { color: colors.onAccent }]}>{title}</AppText>
    </Pressable>
  );
}

export function OutlineButton({
  title,
  onPress,
  icon: Icon,
  fullWidth = false,
  disabled = false,
  style,
}: ButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.outline,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={sizes.iconMd} color={colors.accent} /> : null}
      <AppText tone="accent" style={styles.label}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: layout.button.gap,
    height: sizes.buttonHeight,
    justifyContent: 'center',
    paddingHorizontal: layout.button.paddingHorizontal,
  },
  outline: {
    borderWidth: sizes.border,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.uiSemibold,
    fontSize: fontSize.button,
  },
});
