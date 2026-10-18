import { Text, type TextProps } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, typography, type Colors } from '../theme/tokens';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'ok'
  | 'warn'
  | 'inspect'
  | 'danger';
export type TextVariant = keyof typeof typography;
export type MonoWeight = 'regular' | 'semibold' | 'bold';

const TONE_COLOR: Record<TextTone, keyof Colors> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'accent',
  ok: 'ok',
  warn: 'warn',
  inspect: 'inspect',
  danger: 'danger',
};

const MONO_FONT: Record<MonoWeight, string> = {
  regular: fonts.mono,
  semibold: fonts.monoSemibold,
  bold: fonts.monoBold,
};

/** Заголовок секции по умолчанию третичный — так он задан в макете. */
const DEFAULT_TONE: Record<TextVariant, TextTone> = {
  title: 'primary',
  heading: 'primary',
  body: 'primary',
  bodyMedium: 'primary',
  caption: 'primary',
  label: 'primary',
  sectionLabel: 'tertiary',
};

/** Цвет текста по роли из активной палитры. */
export function useToneColor(tone: TextTone): string {
  const colors = useColors();
  return colors[TONE_COLOR[tone]];
}

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

export function AppText({ variant = 'body', tone, style, ...rest }: AppTextProps) {
  const color = useToneColor(tone ?? DEFAULT_TONE[variant]);
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}

export interface MonoTextProps extends TextProps {
  tone?: TextTone;
  size?: number;
  weight?: MonoWeight;
}

export function MonoText({
  tone = 'primary',
  size = typography.body.fontSize,
  weight = 'regular',
  style,
  ...rest
}: MonoTextProps) {
  const color = useToneColor(tone);
  return <Text {...rest} style={[{ fontFamily: MONO_FONT[weight], fontSize: size, color }, style]} />;
}
