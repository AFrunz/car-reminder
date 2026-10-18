import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';
import { AppBar, AppText, Banner, BottomSheet, Field, PrimaryButton, SelectField } from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, lineHeight, sizes, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useGarage } from '../state/GarageContext';
import { createCustomPart, getPart, updatePart } from '../db/repositories';
import { CATEGORY_KEYS, type CategoryKey } from '../domain/types';
import { parseNumberInput } from '../lib/format';

/**
 * Своя запчасть: название, категория и интервалы. Полей последней замены здесь нет —
 * сведения о заменах берутся исключительно из записей ТО, и единый источник избавляет
 * от расхождений между карточкой детали и историей.
 *
 * Обязательное поле одно — название. Интервалы можно не задавать: деталь, которую меняют
 * по состоянию, а не по регламенту, живёт в каталоге выключенной, пока интервал не появится.
 */

type FormRoute = RouteProp<RootStackParamList, 'PartForm'>;
type FormNavigation = NativeStackNavigationProp<RootStackParamList, 'PartForm'>;

export default function PartFormScreen() {
  const route = useRoute<FormRoute>();
  const navigation = useNavigation<FormNavigation>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t } = useTranslation();
  const { activeCar, refresh } = useGarage();

  const partId = route.params?.partId;

  const [carId, setCarId] = useState<string | null>(activeCar?.id ?? null);
  const [name, setName] = useState('');
  const [categoryKey, setCategoryKey] = useState<CategoryKey>(CATEGORY_KEYS[0]);
  const [intervalKmText, setIntervalKmText] = useState('');
  const [intervalMonthsText, setIntervalMonthsText] = useState('');
  const [inspectKmText, setInspectKmText] = useState('');
  const [inspectMonthsText, setInspectMonthsText] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  // При создании деталь заводится для активной машины; при редактировании — остаётся у своей.
  useEffect(() => {
    if (partId === undefined) setCarId(activeCar?.id ?? null);
  }, [activeCar, partId]);

  useEffect(() => {
    if (partId === undefined) return;
    let cancelled = false;
    void (async () => {
      const part = await getPart(partId);
      if (!part || cancelled) return;
      setCarId(part.carId);
      // У каталожной детали собственного названия ещё нет — подставляем перевод,
      // чтобы поле не открывалось пустым.
      setName(part.name ?? (part.catalogKey === null ? '' : t(`catalog.${part.catalogKey}`)));
      setCategoryKey(part.categoryKey);
      setIntervalKmText(part.intervalKm == null ? '' : String(part.intervalKm));
      setIntervalMonthsText(part.intervalMonths == null ? '' : String(part.intervalMonths));
      setInspectKmText(part.inspectKm == null ? '' : String(part.inspectKm));
      setInspectMonthsText(part.inspectMonths == null ? '' : String(part.inspectMonths));
    })();
    return () => {
      cancelled = true;
    };
  }, [partId, t]);

  const submit = useCallback(() => {
    const trimmed = name.trim();
    const intervalKm = parseNumberInput(intervalKmText);
    const intervalMonths = parseNumberInput(intervalMonthsText);
    const inspectKm = parseNumberInput(inspectKmText);
    const inspectMonths = parseNumberInput(inspectMonthsText);

    const missingName = trimmed.length === 0;
    setNameError(missingName ? t('partForm.nameRequired') : null);
    if (missingName || carId === null) return;

    void (async () => {
      if (partId === undefined) {
        // Деталь без интервалов сохраняется как обычно: `createCustomPart` сам заведёт её
        // выключенной, потому что ресурс у неё считать не из чего.
        await createCustomPart({
          carId,
          name: trimmed,
          categoryKey,
          intervalKm,
          intervalMonths,
          inspectKm,
          inspectMonths,
        });
      } else {
        await updatePart(partId, {
          name: trimmed,
          categoryKey,
          intervalKm,
          intervalMonths,
          inspectKm,
          inspectMonths,
        });
      }
      refresh();
      navigation.goBack();
    })();
  }, [
    carId,
    categoryKey,
    inspectKmText,
    inspectMonthsText,
    intervalKmText,
    intervalMonthsText,
    name,
    navigation,
    partId,
    refresh,
    t,
  ]);

  const pickCategory = useCallback((key: CategoryKey) => {
    setCategoryKey(key);
    setCategorySheetOpen(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar
        title={partId === undefined ? t('partForm.title') : t('partForm.editTitle')}
        onBack={navigation.goBack}
        right={
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [styles.saveAction, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText tone="accent" style={styles.saveLabel}>
              {t('common.save')}
            </AppText>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: sizes.screenPadding + insets.bottom },
          ]}
        >
          <View style={styles.block}>
            <Field
              label={t('partForm.name')}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setNameError(null);
              }}
              placeholder={t('partForm.namePlaceholder')}
            />
            {nameError ? (
              <AppText variant="caption" tone="danger">
                {nameError}
              </AppText>
            ) : null}
          </View>

          <SelectField
            label={t('partForm.category')}
            value={t(`category.${categoryKey}`)}
            onPress={() => setCategorySheetOpen(true)}
          />

          <View style={styles.intervalGroup}>
            <AppText variant="sectionLabel">{t('partForm.interval')}</AppText>
            <View style={styles.intervalRow}>
              <Field
                style={styles.flex}
                label={t('partForm.byMileage')}
                value={intervalKmText}
                onChangeText={setIntervalKmText}
                suffix={t('units.km')}
                keyboardType="number-pad"
                mono
              />
              <Field
                style={styles.flex}
                label={t('partForm.byTime')}
                value={intervalMonthsText}
                onChangeText={setIntervalMonthsText}
                suffix={t('units.months')}
                keyboardType="number-pad"
                mono
              />
            </View>
            {/* Интервал необязателен — предупреждаем всегда, а не только при пустых полях. */}
            <AppText variant="caption" tone="tertiary" style={styles.note}>
              {t('partForm.noIntervalHint')}
            </AppText>
          </View>

          <View style={styles.intervalGroup}>
            <AppText variant="sectionLabel">{t('partForm.inspectInterval')}</AppText>
            <View style={styles.intervalRow}>
              <Field
                style={styles.flex}
                label={t('partForm.byMileage')}
                value={inspectKmText}
                onChangeText={setInspectKmText}
                suffix={t('units.km')}
                keyboardType="number-pad"
                mono
              />
              <Field
                style={styles.flex}
                label={t('partForm.byTime')}
                value={inspectMonthsText}
                onChangeText={setInspectMonthsText}
                suffix={t('units.months')}
                keyboardType="number-pad"
                mono
              />
            </View>
            <AppText variant="caption" tone="tertiary" style={styles.note}>
              {t('partForm.inspectHint')}
            </AppText>
          </View>

          <Banner tone="info" text={t('partForm.intervalHint')} />

          <AppText variant="caption" tone="tertiary" style={styles.note}>
            {t('partForm.changesHint')}
          </AppText>

          <View style={styles.spacer} />

          <PrimaryButton
            fullWidth
            disabled={carId === null}
            title={partId === undefined ? t('partForm.submit') : t('common.save')}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        title={t('partForm.category')}
      >
        <ScrollView
          style={styles.categoryList}
          contentContainerStyle={{ paddingBottom: layout.sheet.footerPaddingBottom }}
        >
          {CATEGORY_KEYS.map((key) => {
            const selected = key === categoryKey;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => pickCategory(key)}
                style={({ pressed }) => [styles.categoryRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <AppText tone={selected ? 'accent' : 'primary'} style={styles.categoryLabel}>
                  {t(`category.${key}`)}
                </AppText>
                {selected ? <Check size={sizes.iconMd} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** Список категорий не должен занимать весь экран — девять строк помещаются в шторку. */
const CATEGORY_LIST_MAX_HEIGHT = 420;
/** Текстовая кнопка «Сохранить» в шапке — 15 по макету. */
const SAVE_LABEL_SIZE = 15;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: sizes.screenPadding,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  saveAction: {
    alignItems: 'center',
    height: sizes.iconButton,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  saveLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: SAVE_LABEL_SIZE,
  },
  block: {
    gap: layout.field.gap,
  },
  intervalGroup: {
    gap: spacing.sm + 2,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  note: {
    lineHeight: typography.caption.fontSize * lineHeight.relaxed,
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing.sm,
  },
  categoryList: {
    maxHeight: CATEGORY_LIST_MAX_HEIGHT,
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    height: sizes.fieldHeight,
    justifyContent: 'space-between',
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  categoryLabel: {
    flex: 1,
    fontSize: fontSize.fieldValue,
  },
});
