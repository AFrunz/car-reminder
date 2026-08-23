import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Car as CarIcon, Check, ChevronRight, Download, Plus, Upload } from 'lucide-react-native';
import { AppText, BottomSheet, SectionHeader } from '../ui';
import { useColors, useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { fonts, radius, sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { exportBackup, importBackup } from '../db/backup';
import { changeLanguage, currentLanguage, SUPPORTED_LANGUAGES, type Language } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import type { Car } from '../domain/types';
import appConfig from '../../app.json';

/**
 * Настройки: машины, язык, тема, перенос данных. Экран ничего не кэширует — список машин
 * приходит из гаража, язык и тема живут в своих провайдерах, а импорт заканчивается
 * `refresh()`, потому что база после него полностью другая.
 */

const THEME_OPTIONS: readonly ThemePreference[] = ['system', 'light', 'dark'] as const;

const THEME_LABEL_KEY: Record<ThemePreference, string> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

const LANGUAGE_LABEL_KEY: Record<Language, string> = {
  ru: 'settings.languageRu',
  en: 'settings.languageEn',
};

type Sheet = 'language' | 'theme' | null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { cars, refresh } = useGarage();
  const { preference, setPreference } = useTheme();
  const language = currentLanguage();

  const [sheet, setSheet] = useState<Sheet>(null);

  const carSubtitle = (car: Car): string =>
    t('settings.carSubtitle', {
      year: String(car.year),
      fuel: t(`fuel.${car.fuel}`).toLocaleLowerCase(),
      transmission: t(`transmission.${car.transmission}`).toLocaleLowerCase(),
    });

  const handleExport = async (): Promise<void> => {
    try {
      if ((await exportBackup()) === 'unavailable') Alert.alert(t('settings.exportFailed'));
    } catch {
      Alert.alert(t('settings.exportFailed'));
    }
  };

  const runImport = async (): Promise<void> => {
    try {
      const result = await importBackup();
      if (result.status === 'cancelled') return;
      if (result.status === 'invalid') {
        Alert.alert(
          t('settings.importFailed'),
          t(
            result.reason === 'not-json'
              ? 'settings.importInvalidNotJson'
              : result.reason === 'wrong-app'
                ? 'settings.importInvalidWrongApp'
                : 'settings.importInvalidVersion',
          ),
        );
        return;
      }
      Alert.alert(
        t('settings.importDone'),
        `${t('settings.importDoneCars', { count: result.cars })} · ${t('records.count', {
          count: result.records,
        })}`,
      );
      refresh();
    } catch {
      Alert.alert(t('settings.importFailed'));
    }
  };

  const handleImport = (): void => {
    Alert.alert(t('settings.importConfirm'), t('settings.importWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.import'), style: 'destructive', onPress: () => void runImport() },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <AppText variant="title" numberOfLines={1}>
          {t('settings.title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <SectionHeader title={t('settings.cars')} />
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {cars.map((car) => (
              <Row
                key={car.id}
                divider
                onPress={() => navigation.navigate('CarForm', { carId: car.id })}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.surfaceAlt }]}>
                  <CarIcon size={19} color={colors.textSecondary} />
                </View>
                <View style={styles.rowText}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {`${car.make} ${car.model}`.trim()}
                  </AppText>
                  <AppText tone="secondary" numberOfLines={1} style={styles.rowSubtitle}>
                    {carSubtitle(car)}
                  </AppText>
                </View>
                <ChevronRight size={sizes.iconSm} color={colors.textTertiary} />
              </Row>
            ))}
            <Row onPress={() => navigation.navigate('CarForm')} gap={10}>
              <Plus size={sizes.iconMd} color={colors.accent} />
              <AppText tone="accent" style={styles.accentLabel}>
                {t('settings.addCar')}
              </AppText>
            </Row>
          </View>
        </View>

        <View style={styles.group}>
          <SectionHeader title={t('settings.app')} />
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Row divider tall onPress={() => setSheet('language')}>
              <AppText style={styles.rowTitle}>{t('settings.language')}</AppText>
              <View style={styles.value}>
                <AppText tone="secondary" style={styles.valueText}>
                  {t(LANGUAGE_LABEL_KEY[language])}
                </AppText>
                <ChevronRight size={sizes.iconSm} color={colors.textTertiary} />
              </View>
            </Row>
            <Row tall onPress={() => setSheet('theme')}>
              <AppText style={styles.rowTitle}>{t('settings.theme')}</AppText>
              <View style={styles.value}>
                <AppText tone="secondary" style={styles.valueText}>
                  {t(THEME_LABEL_KEY[preference])}
                </AppText>
                <ChevronRight size={sizes.iconSm} color={colors.textTertiary} />
              </View>
            </Row>
          </View>
        </View>

        <View style={styles.group}>
          <SectionHeader title={t('settings.data')} />
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Row divider tall onPress={() => void handleExport()}>
              <Download size={sizes.iconMd} color={colors.textSecondary} />
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle}>{t('settings.export')}</AppText>
                <AppText tone="tertiary" style={styles.rowSubtitle}>
                  {t('settings.exportHint')}
                </AppText>
              </View>
            </Row>
            <Row tall onPress={handleImport}>
              <Upload size={sizes.iconMd} color={colors.textSecondary} />
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle}>{t('settings.import')}</AppText>
                <AppText tone="tertiary" style={styles.rowSubtitle}>
                  {t('settings.importHint')}
                </AppText>
              </View>
            </Row>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <AppText tone="tertiary" style={styles.version}>
            {t('settings.version', { version: appConfig.expo.version })}
          </AppText>
        </View>
      </ScrollView>

      <BottomSheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={t('settings.language')}
      >
        <View style={styles.sheetList}>
          {SUPPORTED_LANGUAGES.map((code) => (
            <OptionRow
              key={code}
              label={t(LANGUAGE_LABEL_KEY[code])}
              selected={code === language}
              onPress={() => {
                setSheet(null);
                void changeLanguage(code);
              }}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'theme'}
        onClose={() => setSheet(null)}
        title={t('settings.theme')}
      >
        <View style={styles.sheetList}>
          {THEME_OPTIONS.map((option) => (
            <OptionRow
              key={option}
              label={t(THEME_LABEL_KEY[option])}
              selected={option === preference}
              onPress={() => {
                setSheet(null);
                setPreference(option);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

interface RowProps {
  children: React.ReactNode;
  onPress: () => void;
  divider?: boolean;
  /** Строки без иконки-квадрата в макете выше по вертикали. */
  tall?: boolean;
  gap?: number;
}

function Row({ children, onPress, divider = false, tall = false, gap = spacing.md }: RowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { gap, opacity: pressed ? 0.7 : 1 },
        tall && styles.rowTall,
        divider && { borderBottomColor: colors.border, borderBottomWidth: sizes.border },
      ]}
    >
      {children}
    </Pressable>
  );
}

interface OptionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function OptionRow({ label, selected, onPress }: OptionRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetRow,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <AppText variant="bodyMedium">{label}</AppText>
      {selected ? <Check size={sizes.iconMd} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  appBar: {
    justifyContent: 'center',
    height: sizes.appBarHeight,
    paddingHorizontal: sizes.screenPadding,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    padding: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  group: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 14,
  },
  rowTall: {
    paddingVertical: 15,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 11,
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    flex: 1,
  },
  rowSubtitle: {
    fontSize: 12,
  },
  accentLabel: {
    fontFamily: fonts.uiSemibold,
  },
  value: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  valueText: {
    fontSize: 14,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },
  footer: {
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
  },
  sheetList: {
    paddingBottom: spacing.sm,
    paddingHorizontal: sizes.screenPadding,
  },
  sheetRow: {
    alignItems: 'center',
    borderBottomWidth: sizes.border,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
});
