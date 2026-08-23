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

/** Обе палитры описывают один и тот же набор ролей, значения — обычные строки. */
export type Colors = { [K in keyof (typeof palette)['light']]: string };

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
  xs: 4,
  sm: 8,
  /** Активный сегмент внутри переключателя с паддингом 3. */
  segment: 9,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  sheet: 24,
  grabber: 2,
  pill: 999,
} as const;

/** Типографическая шкала макета. */
export const typography = {
  title: { fontFamily: fonts.uiBold, fontSize: 21 },
  heading: { fontFamily: fonts.uiBold, fontSize: 18 },
  body: { fontFamily: fonts.ui, fontSize: 15 },
  bodyMedium: { fontFamily: fonts.uiMedium, fontSize: 15 },
  caption: { fontFamily: fonts.ui, fontSize: 13 },
  label: { fontFamily: fonts.ui, fontSize: 12 },
  sectionLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} as const;

/** Кегли, которые не попадают в общую типографическую шкалу. */
export const fontSize = {
  appBarTitle: 17,
  sheetTitle: 18,
  button: 16,
  fieldLabel: 12,
  fieldValue: 16,
  fieldSuffix: 14,
  segment: 14,
  badge: 11,
  banner: 13,
  partSubtitle: 12,
} as const;

/** Межстрочный интервал как множитель кегля. */
export const lineHeight = {
  relaxed: 1.45,
} as const;

export const spacing = {
  xxs: 3,
  xs: 4,
  s: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Паддинги и зазоры компонентов — сняты с макета попиксельно. */
export const layout = {
  partRow: { paddingVertical: 10, paddingHorizontal: 14, gap: 13, textGap: 3 },
  field: { gap: 7, paddingHorizontal: 14 },
  appBar: { paddingHorizontal: 10, gap: 2 },
  carAppBar: { paddingHorizontal: 16, gap: 6 },
  badge: { paddingVertical: 5, paddingHorizontal: 9 },
  banner: { padding: 14, gap: 11 },
  button: { gap: 8, paddingHorizontal: 16 },
  sheet: {
    grabberPaddingTop: 10,
    grabberPaddingBottom: 6,
    headerPaddingTop: 6,
    headerPaddingBottom: 12,
    paddingHorizontal: 16,
    footerPaddingTop: 12,
    footerPaddingBottom: 16,
  },
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
  /** Круглая кнопка в шапке и квадрат под иконку в строках настроек. */
  iconButton: 38,
  /** Строка детали: кольцо 44 плюс вертикальные паддинги по 10. */
  partRowHeight: 64,
  cardPadding: 18,
  segmentHeight: 38,
  segmentPadding: 3,
  progressHeight: 8,
  toggleWidth: 44,
  toggleHeight: 26,
  toggleKnob: 22,
  toggleGap: 2,
  grabberWidth: 40,
  grabberHeight: 4,
  iconXs: 13,
  iconSm: 16,
  iconMd: 18,
  iconLg: 20,
  iconBack: 21,
  iconNav: 22,
  border: 1,
} as const;
