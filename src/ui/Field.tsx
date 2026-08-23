import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, radius, sizes } from '../theme/tokens';
import { AppText } from './Text';

interface FieldShellProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

function FieldShell({ label, style, children }: FieldShellProps) {
  const colors = useColors();
  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <AppText variant="label" tone="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export interface FieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Моноширинное значение — для пробега, интервалов и сумм. */
  mono?: boolean;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  value,
  onChangeText,
  suffix,
  placeholder,
  keyboardType,
  mono = false,
  editable = true,
  style,
}: FieldProps) {
  const colors = useColors();
  return (
    <FieldShell label={label} style={style}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        editable={editable}
        style={[
          styles.input,
          { color: editable ? colors.textPrimary : colors.textSecondary },
          { fontFamily: mono ? fonts.mono : fonts.ui },
        ]}
      />
      {suffix ? (
        <AppText tone="tertiary" style={styles.suffix}>
          {suffix}
        </AppText>
      ) : null}
    </FieldShell>
  );
}

export interface SelectFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SelectField({ label, value, placeholder, onPress, style }: SelectFieldProps) {
  const colors = useColors();
  const isEmpty = value.length === 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}>
      <FieldShell label={label}>
        <AppText
          numberOfLines={1}
          tone={isEmpty ? 'tertiary' : 'primary'}
          style={styles.selectValue}
        >
          {isEmpty ? (placeholder ?? '') : value}
        </AppText>
        <ChevronDown size={sizes.iconMd} color={colors.textTertiary} />
      </FieldShell>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: layout.field.gap,
  },
  label: {
    fontFamily: fonts.uiMedium,
  },
  box: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: sizes.border,
    flexDirection: 'row',
    height: sizes.fieldHeight,
    justifyContent: 'space-between',
    paddingHorizontal: layout.field.paddingHorizontal,
  },
  input: {
    flex: 1,
    fontSize: fontSize.fieldValue,
    padding: 0,
  },
  suffix: {
    fontSize: fontSize.fieldSuffix,
  },
  selectValue: {
    flex: 1,
    fontSize: fontSize.fieldValue,
  },
});
