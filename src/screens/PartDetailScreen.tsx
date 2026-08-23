import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { Pencil } from 'lucide-react-native';
import { AppBar, AppText, BottomSheet, Card, Donut, Field, MonoText, PrimaryButton } from '../ui';
import type { TextTone } from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, radius, sizes, spacing } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useGarage } from '../state/GarageContext';
import {
  deleteOrHidePart,
  getCar,
  getPart,
  historyForPart,
  lastChangeForPart,
  listRecords,
  todayIso,
  updatePart,
} from '../db/repositories';
import { calculateResource, NO_DATA, type Resource } from '../domain/resource';
import { effectiveMileage } from '../domain/validation';
import type { Part } from '../domain/types';
import { formatDate, formatNumber, parseNumberInput } from '../lib/format';
import type { Language } from '../i18n';

/**
 * Карточка детали: состояние ресурса, редактируемые название и интервалы, история замен
 * и скрытие детали. Кнопки «заменить сейчас» здесь нет — замена фиксируется только
 * записью ТО, поэтому единственный способ обнулить счётчик проходит через историю.
 */

interface HistoryEntry {
  recordId: string;
  mileage: number;
  date: string;
  cost: number | null;
}

/** Всё, что экран читает из базы за один проход, — чтобы не мигать полупустым состоянием. */
interface PartDetailData {
  part: Part;
  resource: Resource;
  history: HistoryEntry[];
}

type DetailRoute = RouteProp<RootStackParamList, 'PartDetail'>;
type DetailNavigation = NativeStackNavigationProp<RootStackParamList, 'PartDetail'>;

export default function PartDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNavigation>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t, i18n } = useTranslation();
  const { refresh, revision } = useGarage();
  const language: Language = i18n.language === 'ru' ? 'ru' : 'en';

  const { partId } = route.params;

  const [data, setData] = useState<PartDetailData | null>(null);

  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const [intervalSheetOpen, setIntervalSheetOpen] = useState(false);
  const [kmDraft, setKmDraft] = useState('');
  const [monthsDraft, setMonthsDraft] = useState('');
  const [intervalError, setIntervalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const part = await getPart(partId);
      if (!part) {
        if (!cancelled) setData(null);
        return;
      }
      const [lastChange, records, history, car] = await Promise.all([
        lastChangeForPart(partId),
        listRecords(part.carId),
        historyForPart(partId),
        getCar(part.carId),
      ]);
      const mileage = effectiveMileage(car?.mileage ?? 0, records);
      const resource = car
        ? calculateResource(part, lastChange, mileage, todayIso())
        : NO_DATA;
      if (!cancelled) setData({ part, resource, history });
    })();
    return () => {
      cancelled = true;
    };
  }, [partId, revision]);

  const part = data?.part ?? null;
  const resource = data?.resource ?? NO_DATA;
  const history = data?.history ?? [];

  const partName =
    part === null
      ? ''
      : (part.name ?? (part.catalogKey === null ? '' : t(`catalog.${part.catalogKey}`)));

  const openNameSheet = useCallback(() => {
    setNameDraft(partName);
    setNameError(null);
    setNameSheetOpen(true);
  }, [partName]);

  const saveName = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (trimmed.length === 0) {
      setNameError(t('partDetail.nameRequired'));
      return;
    }
    void (async () => {
      // Каталожная деталь при первом переименовании просто получает собственное `name`
      // и перестаёт зависеть от перевода по catalogKey.
      await updatePart(partId, { name: trimmed });
      setNameSheetOpen(false);
      refresh();
    })();
  }, [nameDraft, partId, refresh, t]);

  const openIntervalSheet = useCallback(() => {
    setKmDraft(part?.intervalKm == null ? '' : String(part.intervalKm));
    setMonthsDraft(part?.intervalMonths == null ? '' : String(part.intervalMonths));
    setIntervalError(null);
    setIntervalSheetOpen(true);
  }, [part]);

  const saveIntervals = useCallback(() => {
    const intervalKm = parseNumberInput(kmDraft);
    const intervalMonths = parseNumberInput(monthsDraft);
    // Хотя бы один интервал обязателен: без него ресурс просто не из чего считать.
    if (intervalKm === null && intervalMonths === null) {
      setIntervalError(t('partDetail.intervalRequired'));
      return;
    }
    void (async () => {
      await updatePart(partId, { intervalKm, intervalMonths });
      setIntervalSheetOpen(false);
      refresh();
    })();
  }, [kmDraft, monthsDraft, partId, refresh, t]);

  const confirmHide = useCallback(() => {
    Alert.alert(t('partDetail.hideConfirm', { name: partName }), t('partDetail.hideWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.hide'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteOrHidePart(partId);
            refresh();
            navigation.goBack();
          })();
        },
      },
    ]);
  }, [navigation, partId, partName, refresh, t]);

  const kmLine = describeKm(resource, language, t);
  const monthsLine = describeMonths(resource, language, t);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar title={partName} onBack={navigation.goBack} />
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
          <View style={styles.stateBlock}>
            <Donut size={sizes.donutLg} value={resource.value} status={resource.status} />
            <View style={styles.stateText}>
              <MonoText weight="bold" size={REMAINING_SIZE} tone={kmLine.tone}>
                {kmLine.text}
              </MonoText>
              {monthsLine ? (
                <AppText variant="caption" tone={monthsLine.tone}>
                  {monthsLine.text}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.block}>
            <AppText variant="sectionLabel">{t('partDetail.name')}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={openNameSheet}
              style={({ pressed }) => [
                styles.nameBox,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <AppText numberOfLines={2} style={styles.nameValue}>
                {partName}
              </AppText>
              <Pencil size={sizes.iconXs} color={colors.textTertiary} />
            </Pressable>
          </View>

          <View style={styles.intervals}>
            <IntervalTile
              label={t('partDetail.intervalKm')}
              value={
                part?.intervalKm == null
                  ? null
                  : t('units.kmValue', { value: formatNumber(part.intervalKm, language) })
              }
              empty={t('partDetail.intervalNotSet')}
              onPress={openIntervalSheet}
            />
            <IntervalTile
              label={t('partDetail.intervalMonths')}
              value={
                part?.intervalMonths == null
                  ? null
                  : t('units.monthsValue', { value: part.intervalMonths })
              }
              empty={t('partDetail.intervalNotSet')}
              onPress={openIntervalSheet}
            />
          </View>

          <View style={styles.block}>
            <AppText variant="sectionLabel">{t('partDetail.changes')}</AppText>
            {history.length === 0 ? (
              <Card style={styles.emptyCard}>
                <AppText variant="bodyMedium">{t('partDetail.noChanges')}</AppText>
                <AppText variant="caption" tone="tertiary">
                  {t('partDetail.noChangesHint')}
                </AppText>
              </Card>
            ) : (
              <Card padding={0} radius={radius.xl}>
                {history.map((entry, index) => (
                  <View key={entry.recordId} style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <MonoText weight="semibold" size={HISTORY_VALUE_SIZE}>
                        {t('units.kmValue', { value: formatNumber(entry.mileage, language) })}
                      </MonoText>
                      <AppText variant="label" tone="secondary">
                        {formatDate(entry.date, language)}
                      </AppText>
                      {index === 0 ? (
                        <AppText tone="accent" style={styles.lastChange}>
                          {t('partDetail.lastChange')}
                        </AppText>
                      ) : null}
                    </View>
                    <MonoText weight="semibold" size={HISTORY_VALUE_SIZE}>
                      {entry.cost == null
                        ? t('common.dash')
                        : formatNumber(entry.cost, language)}
                    </MonoText>
                  </View>
                ))}
              </Card>
            )}
          </View>

          <View style={styles.spacer} />

          <Pressable
            accessibilityRole="button"
            onPress={confirmHide}
            style={({ pressed }) => [styles.hideButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText tone="danger" style={styles.hideLabel}>
              {t('partDetail.hide')}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={nameSheetOpen}
        onClose={() => setNameSheetOpen(false)}
        title={t('partDetail.editName')}
        footer={<PrimaryButton fullWidth title={t('common.save')} onPress={saveName} />}
      >
        <View style={styles.sheetBody}>
          <Field
            label={t('partDetail.name')}
            value={nameDraft}
            onChangeText={(value) => {
              setNameDraft(value);
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
      </BottomSheet>

      <BottomSheet
        visible={intervalSheetOpen}
        onClose={() => setIntervalSheetOpen(false)}
        title={t('partDetail.editIntervals')}
        footer={<PrimaryButton fullWidth title={t('common.save')} onPress={saveIntervals} />}
      >
        <View style={styles.sheetBody}>
          <View style={styles.intervalRow}>
            <Field
              style={styles.flex}
              label={t('partForm.byMileage')}
              value={kmDraft}
              onChangeText={(value) => {
                setKmDraft(value);
                setIntervalError(null);
              }}
              suffix={t('units.km')}
              keyboardType="number-pad"
              mono
            />
            <Field
              style={styles.flex}
              label={t('partForm.byTime')}
              value={monthsDraft}
              onChangeText={(value) => {
                setMonthsDraft(value);
                setIntervalError(null);
              }}
              suffix={t('units.months')}
              keyboardType="number-pad"
              mono
            />
          </View>
          {intervalError ? (
            <AppText variant="caption" tone="danger">
              {intervalError}
            </AppText>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

interface IntervalTileProps {
  label: string;
  /** null — интервал по этой шкале не задан. */
  value: string | null;
  empty: string;
  onPress: () => void;
}

function IntervalTile({ label, value, empty, onPress }: IntervalTileProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.tileHead}>
        <AppText variant="sectionLabel" numberOfLines={2} style={styles.flex}>
          {label}
        </AppText>
        <Pencil size={sizes.iconXs} color={colors.textTertiary} />
      </View>
      {value === null ? (
        <AppText tone="tertiary" style={styles.tileValue}>
          {empty}
        </AppText>
      ) : (
        <MonoText weight="semibold" size={TILE_VALUE_SIZE}>
          {value}
        </MonoText>
      )}
    </Pressable>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

interface StateLine {
  text: string;
  tone: TextTone;
}

/**
 * Крупная строка остатка. Кольцо строится по километрам, если километровый интервал
 * задан, поэтому здесь та же развилка: `basis === 'km'` — километры, иначе месяцы.
 */
function describeKm(resource: Resource, language: Language, t: Translate): StateLine {
  if (resource.status === 'no-data') return { text: t('parts.noData'), tone: 'tertiary' };
  if (resource.basis === 'km' && resource.kmLeft != null) {
    if (resource.kmLeft <= 0) {
      return {
        text: t('partDetail.overdueKm', { km: formatNumber(-resource.kmLeft, language) }),
        tone: 'danger',
      };
    }
    return {
      text: t('partDetail.remainingKm', { km: formatNumber(resource.kmLeft, language) }),
      tone: 'primary',
    };
  }
  if (resource.monthsLeft == null) return { text: t('parts.noData'), tone: 'tertiary' };
  if (resource.monthsLeft < 0) {
    return {
      text: t('partDetail.overdueMonths', {
        count: -resource.monthsLeft,
        months: -resource.monthsLeft,
      }),
      tone: 'danger',
    };
  }
  return {
    text: t('partDetail.remainingMonthsPrimary', {
      count: resource.monthsLeft,
      months: formatNumber(resource.monthsLeft, language),
    }),
    tone: 'primary',
  };
}

/**
 * Вторая шкала под крупной строкой. Существует только когда кольцо построено по
 * километрам, а временной интервал тоже задан: при `basis === 'time'` километрового
 * остатка попросту нет.
 */
function describeMonths(resource: Resource, language: Language, t: Translate): StateLine | null {
  if (resource.status === 'no-data') return null;
  if (resource.basis !== 'km' || resource.monthsLeft == null) return null;
  if (resource.monthsLeft < 0) {
    return {
      text: t('partDetail.overdueMonths', {
        count: -resource.monthsLeft,
        months: -resource.monthsLeft,
      }),
      // Просрочка по времени не обнуляет кольцо, но подпись обязана быть красной.
      tone: 'danger',
    };
  }
  return {
    text: t('partDetail.remainingMonths', {
      count: resource.monthsLeft,
      months: resource.monthsLeft,
    }),
    tone: 'secondary',
  };
}

/** Кегли, встречающиеся только на этом экране. */
const REMAINING_SIZE = 20;
const TILE_VALUE_SIZE = 17;
const HISTORY_VALUE_SIZE = 15;
const LAST_CHANGE_SIZE = 11;
const HIDE_BUTTON_HEIGHT = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md + 2,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  spacer: {
    flexGrow: 1,
  },
  stateBlock: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  stateText: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  block: {
    gap: layout.field.gap,
  },
  nameBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.fieldHeight,
    paddingHorizontal: layout.field.paddingHorizontal,
    paddingVertical: spacing.md,
  },
  nameValue: {
    flex: 1,
    fontSize: fontSize.fieldValue,
  },
  intervals: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  tile: {
    borderRadius: radius.lg,
    flex: 1,
    gap: spacing.xs + 1,
    padding: spacing.md,
  },
  tileHead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.s,
    justifyContent: 'space-between',
  },
  tileValue: {
    fontSize: fontSize.fieldValue,
  },
  emptyCard: {
    gap: spacing.s,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 2,
    justifyContent: 'space-between',
    paddingHorizontal: layout.partRow.paddingHorizontal,
    paddingVertical: spacing.md + 1,
  },
  historyLeft: {
    flex: 1,
    gap: spacing.xxs,
  },
  lastChange: {
    fontFamily: fonts.uiSemibold,
    fontSize: LAST_CHANGE_SIZE,
  },
  hideButton: {
    alignItems: 'center',
    height: HIDE_BUTTON_HEIGHT,
    justifyContent: 'center',
  },
  hideLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: fontSize.fieldSuffix,
  },
  sheetBody: {
    gap: layout.field.gap,
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
});
