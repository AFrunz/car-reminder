/**
 * Значения синхронизированы с design.pen — при правке макета обновляй здесь же.
 */

export type ThemeMode = 'light' | 'dark';

export const palette = {
  light: {
    bg: '#F2F4F7',
    surface: '#FFFFFF',
    surfaceAlt: '#EAEEF4',
    border: '#E5E8EE',
    textPrimary: '#101418',
    textSecondary: '#5A626E',
    textTertiary: '#8B93A0',
    accent: '#2E6BE6',
    accentSoft: '#E7EEFD',
    ok: '#29A05C',
    warn: '#DE9526',
    warnSoft: '#FBF0DE',
    danger: '#D8402F',
    ringTrack: '#E9ECF2',
    ringTrackDanger: '#F7DEDB',
    muted: '#C6CBD4',
    scrim: '#0B0F14A6',
    onAccent: '#FFFFFF',
  },
  dark: {
    bg: '#0F1216',
    surface: '#191D23',
    surfaceAlt: '#22272E',
    border: '#2A3038',
    textPrimary: '#F0F2F5',
    textSecondary: '#9AA3B0',
    textTertiary: '#6E7683',
    accent: '#5C8DF6',
    accentSoft: '#1B2842',
    ok: '#3BBE74',
    warn: '#F0AE45',
    warnSoft: '#382C18',
    danger: '#F05A4C',
    ringTrack: '#272D35',
    ringTrackDanger: '#3A2320',
    muted: '#454C56',
    scrim: '#0B0F14A6',
    onAccent: '#FFFFFF',
  },
} as const;

export type Colors = (typeof palette)['light'];

export const fonts = {
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemibold: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  sheet: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Высота строки детали и прочие размеры, на которые опирается вёрстка макета. */
export const sizes = {
  screenPadding: 16,
  appBarHeight: 54,
  tabBarHeight: 70,
  donutSm: 44,
  donutMd: 88,
  donutLg: 150,
  fieldHeight: 50,
  buttonHeight: 52,
} as const;
