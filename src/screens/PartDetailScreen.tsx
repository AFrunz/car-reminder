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
import { ClipboardCheck, Pencil, Star } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Banner,
  BottomSheet,
  Card,
  Donut,
  Field,
  MonoText,
  OutlineButton,
  PrimaryButton,
} from '../ui';
import type { TextTone } from '../ui';
import { useColors } from '../theme/ThemeProvider';
import {
  fonts,
  fontSize,
  layout,
  lineHeight,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useGarage } from '../state/GarageContext';
import {
  deleteOrHidePart,
  getCar,
  getPart,
  historyForPart,
  listRecords,
  partEvents,
  todayIso,
  updatePart,
  type PartHistoryEntry,
} from '../db/repositories';
import {
  baselineForCar,
  NO_DATA,
  resourceForPart,
  summarizePartEvents,
  type InspectionState,
  type Resource,
} from '../domain/resource';
import { effectiveMileage } from '../domain/validation';
import type { Part } from '../domain/types';
import {
  formatDate,
  formatDecimal,
  formatNumber,
  parseDecimalInput,
  parseNumberInput,
} from '../lib/format';
import type { Language } from '../i18n';

/**
 * Карточка детали: состояние ресурса, редактируемые название и интервалы, история замен
 * и проверок и скрытие детали. Кнопки «заменить сейчас» здесь нет — замена фиксируется
 * только записью ТО, поэтому единственный способ обнулить счётчик проходит через историю.
 * Проверка — тоже запись ТО; кнопка «Записать проверку» лишь открывает её заполненной.
 */

/** Всё, что экран читает из базы за один проход, — чтобы не мигать полупустым состоянием. */
interface PartDetailData {
  part: Part;
  resource: Resource;
  history: PartHistoryEntry[];
}

/** Износ задан, только когда есть оба края и новая деталь толще предела. */
const hasWearSpec = (part: Part): boolean =>
  part.wearNew != null && part.wearMin != null && part.wearNew > part.wearMin;

const hasInspection = (part: Part): boolean =>
  part.inspectKm != null || part.inspectMonths != null;

/** Значение для поля ввода: пусто, если не задано. */
const draft = (value: number | null): string => (value == null ? '' : String(value));

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
  const [inspectKmDraft, setInspectKmDraft] = useState('');
  const [inspectMonthsDraft, setInspectMonthsDraft] = useState('');
  const [wearNewDraft, setWearNewDraft] = useState('');
  const [wearMinDraft, setWearMinDraft] = useState('');
  const [intervalError, setIntervalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const part = await getPart(partId);
      if (!part) {
        if (!cancelled) setData(null);
        return;
      }
      const [events, records, history, car] = await Promise.all([
        partEvents(partId),
        listRecords(part.carId),
        historyForPart(partId),
        getCar(part.carId),
      ]);
      const mileage = effectiveMileage(car?.mileage ?? 0, records);
      const resource = car
        ? resourceForPart(
            part,
            summarizePartEvents(events)[partId],
            mileage,
            todayIso(),
            baselineForCar(car),
          )
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
    if (part === null) return;
    setKmDraft(draft(part.intervalKm));
    setMonthsDraft(draft(part.intervalMonths));
    setInspectKmDraft(draft(part.inspectKm));
    setInspectMonthsDraft(draft(part.inspectMonths));
    setWearNewDraft(part.wearNew == null ? '' : formatDecimal(part.wearNew, language));
    setWearMinDraft(part.wearMin == null ? '' : formatDecimal(part.wearMin, language));
    setIntervalError(null);
    setIntervalSheetOpen(true);
  }, [language, part]);

  const saveIntervals = useCallback(() => {
    // Любое поле можно очистить: деталь, которую меняют по состоянию, живёт без интервалов —
    // ресурс у неё просто станет «нет данных».
    const intervalKm = parseNumberInput(kmDraft);
    const intervalMonths = parseNumberInput(monthsDraft);
    const inspectKm = parseNumberInput(inspectKmDraft);
    const inspectMonths = parseNumberInput(inspectMonthsDraft);
    const wearNew = parseDecimalInput(wearNewDraft);
    const wearMin = parseDecimalInput(wearMinDraft);
    // Износ осмыслен только парой: без одного из краёв шкалы процент не посчитать.
    const wearCleared = wearNew === null && wearMin === null;
    if (!wearCleared && (wearNew === null || wearMin === null || wearNew <= wearMin)) {
      setIntervalError(t('partDetail.wearInvalid'));
      return;
    }
    void (async () => {
      await updatePart(partId, {
        intervalKm,
        intervalMonths,
        inspectKm,
        inspectMonths,
        wearNew,
        wearMin,
      });
      setIntervalSheetOpen(false);
      refresh();
    })();
  }, [
    inspectKmDraft,
    inspectMonthsDraft,
    kmDraft,
    monthsDraft,
    partId,
    refresh,
    t,
    wearMinDraft,
    wearNewDraft,
  ]);

  /**
   * Закрепление в избранном. Локальное состояние обновляем сразу, не дожидаясь
   * перезагрузки по `revision`, — иначе звезда переключается с заметной задержкой.
   */
  const togglePinned = useCallback(() => {
    if (part === null) return;
    const next = !part.pinned;
    void (async () => {
      await updatePart(partId, { pinned: next });
      setData((current) =>
        current === null ? current : { ...current, part: { ...current.part, pinned: next } },
      );
      refresh();
    })();
  }, [part, partId, refresh]);

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
  // У детали, которую только осматривают, срок проверки уже стоит крупной строкой.
  const inspectionLine =
    resource.inspection && resource.basis !== 'inspection'
      ? describeInspection(resource.inspection, language, t)
      : null;
  const wearLine = resource.wear
    ? {
        text: resource.wear.extrapolated
          ? t('partDetail.wearEstimated', {
              mm: formatDecimal(resource.wear.measured, language),
              mileage: formatNumber(resource.wear.mileage, language),
              estimate: formatDecimal(resource.wear.estimated, language),
            })
          : t('partDetail.wearMeasured', {
              mm: formatDecimal(resource.wear.measured, language),
              mileage: formatNumber(resource.wear.mileage, language),
            }),
      }
    : null;
  const lastReplacementIndex = history.findIndex((entry) => entry.action === 'replace');

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar
        title={partName}
        onBack={navigation.goBack}
        right={
          part === null ? undefined : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={part.pinned ? t('partDetail.unpin') : t('partDetail.pin')}
              onPress={togglePinned}
              style={({ pressed }) => [styles.pinButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              {/* Залитая звезда — в избранном, контурная — нет: как везде, где есть избранное. */}
              {part.pinned ? (
                <Star size={sizes.iconBack} color={colors.accent} fill={colors.accent} />
              ) : (
                <Star size={sizes.iconBack} color={colors.textPrimary} />
              )}
            </Pressable>
          )
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
              {inspectionLine ? (
                <AppText variant="caption" tone={inspectionLine.tone}>
                  {inspectionLine.text}
                </AppText>
              ) : null}
              {wearLine ? (
                <AppText variant="caption" tone="tertiary">
                  {wearLine.text}
                </AppText>
              ) : null}
            </View>
          </View>

          {/* Числа настоящие, но посчитаны от начала жизни машины — об этом надо сказать. */}
          {resource.assumed && resource.status !== 'no-data' ? (
            <Banner
              tone="info"
              text={
                resource.basis === 'inspection'
                  ? t('partDetail.assumedInspectionHint')
                  : t('partDetail.assumedHint')
              }
            />
          ) : null}

          {/* Износ задан, а замера ещё нет: подсказываем, откуда возьмётся точный расчёт. */}
          {part !== null && hasWearSpec(part) && resource.wear === null ? (
            <Banner tone="info" text={t('partDetail.wearHint')} />
          ) : null}

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
            {/*
              Кратность замены: сколько таких деталей в машине и как их меняют. Подпись
              стоит вплотную к плиткам интервалов, потому что у `each` следом идёт
              пояснение — ответ на вопрос, почему в этих плитках прочерки.
            */}
            {part === null ? null : (
              <View style={styles.scopeBlock}>
                <AppText variant="caption" tone="tertiary">
                  {t(`scope.${part.scope}`)}
                </AppText>
                {part.scope === 'each' ? (
                  <AppText variant="caption" tone="tertiary" style={styles.scopeHint}>
                    {t('scope.eachHint')}
                  </AppText>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.intervals}>
            <IntervalTile
              label={t('partDetail.intervalKm')}
              value={
                part?.intervalKm == null
                  ? null
                  : t('units.kmValue', { value: formatNumber(part.intervalKm, language) })
              }
              empty={t('common.dash')}
              onPress={openIntervalSheet}
            />
            <IntervalTile
              label={t('partDetail.intervalMonths')}
              value={
                part?.intervalMonths == null
                  ? null
                  : t('units.monthsValue', { value: part.intervalMonths })
              }
              empty={t('common.dash')}
              onPress={openIntervalSheet}
            />
          </View>

          <View style={styles.intervals}>
            <IntervalTile
              label={t('partDetail.inspection')}
              value={part === null ? null : formatInspection(part, language, t)}
              empty={t('common.dash')}
              onPress={openIntervalSheet}
            />
            <IntervalTile
              label={t('partDetail.wear')}
              value={
                part !== null && hasWearSpec(part)
                  ? t('partDetail.wearRange', {
                      from: formatDecimal(part.wearNew as number, language),
                      to: formatDecimal(part.wearMin as number, language),
                    })
                  : null
              }
              empty={t('common.dash')}
              onPress={openIntervalSheet}
            />
          </View>

          {part !== null && (hasInspection(part) || hasWearSpec(part)) ? (
            <OutlineButton
              title={t('partDetail.recordInspection')}
              icon={ClipboardCheck}
              fullWidth
              onPress={() => navigation.navigate('RecordForm', { inspectPartId: partId })}
            />
          ) : null}

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
                      {entry.action === 'inspect' ? (
                        <AppText variant="label" tone="inspect">
                          {entry.measurement != null
                            ? t('records.inspectedMeasured', {
                                mm: formatDecimal(entry.measurement, language),
                              })
                            : t('records.inspected')}
                        </AppText>
                      ) : null}
                      {/* Пометка к позиции — модель, артикул; пустую строку не показываем. */}
                      {entry.note?.trim() ? (
                        <AppText
                          variant="label"
                          tone="tertiary"
                          numberOfLines={2}
                          style={styles.historyNote}
                        >
                          {entry.note.trim()}
                        </AppText>
                      ) : null}
                      {index === lastReplacementIndex ? (
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
          <AppText variant="sectionLabel">{t('partForm.interval')}</AppText>
          <View style={styles.intervalRow}>
            <Field
              style={styles.flex}
              label={t('partForm.byMileage')}
              value={kmDraft}
              onChangeText={setKmDraft}
              suffix={t('units.km')}
              keyboardType="number-pad"
              mono
            />
            <Field
              style={styles.flex}
              label={t('partForm.byTime')}
              value={monthsDraft}
              onChangeText={setMonthsDraft}
              suffix={t('units.months')}
              keyboardType="number-pad"
              mono
            />
          </View>

          <AppText variant="sectionLabel" style={styles.sheetSection}>
            {t('partForm.inspectInterval')}
          </AppText>
          <View style={styles.intervalRow}>
            <Field
              style={styles.flex}
              label={t('partForm.byMileage')}
              value={inspectKmDraft}
              onChangeText={setInspectKmDraft}
              suffix={t('units.km')}
              keyboardType="number-pad"
              mono
            />
            <Field
              style={styles.flex}
              label={t('partForm.byTime')}
              value={inspectMonthsDraft}
              onChangeText={setInspectMonthsDraft}
              suffix={t('units.months')}
              keyboardType="number-pad"
              mono
            />
          </View>

          <AppText variant="sectionLabel" style={styles.sheetSection}>
            {t('partDetail.wear')}
          </AppText>
          <View style={styles.intervalRow}>
            <Field
              style={styles.flex}
              label={t('partDetail.wearNew')}
              value={wearNewDraft}
              onChangeText={(value) => {
                setWearNewDraft(value);
                setIntervalError(null);
              }}
              suffix={t('units.mm')}
              keyboardType="decimal-pad"
              mono
            />
            <Field
              style={styles.flex}
              label={t('partDetail.wearMin')}
              value={wearMinDraft}
              onChangeText={(value) => {
                setWearMinDraft(value);
                setIntervalError(null);
              }}
              suffix={t('units.mm')}
              keyboardType="decimal-pad"
              mono
            />
          </View>
          {intervalError ? (
            <AppText variant="caption" tone="danger">
              {intervalError}
            </AppText>
          ) : (
            <AppText variant="caption" tone="tertiary" style={styles.scopeHint}>
              {t('partDetail.wearExplain')}
            </AppText>
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

interface IntervalTileProps {
  label: string;
  /** null — интервал по этой шкале не задан. */
  value: string | null;
  /** Чем заменить число, когда интервала нет, — прочерк. */
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
      <MonoText
        weight="semibold"
        size={TILE_VALUE_SIZE}
        tone={value === null ? 'tertiary' : 'primary'}
      >
        {value ?? empty}
      </MonoText>
    </Pressable>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

interface StateLine {
  text: string;
  tone: TextTone;
}

/** Интервал проверки для плитки: «15 000 км · 12 мес», одна из шкал или ничего. */
function formatInspection(part: Part, language: Language, t: Translate): string | null {
  const km =
    part.inspectKm != null
      ? t('units.kmValue', { value: formatNumber(part.inspectKm, language) })
      : null;
  const months =
    part.inspectMonths != null ? t('units.monthsValue', { value: part.inspectMonths }) : null;
  if (km && months) return `${km} · ${months}`;
  return km ?? months;
}

/** Сколько осталось до проверки — или что она уже нужна. */
function describeInspection(
  inspection: InspectionState,
  language: Language,
  t: Translate,
): StateLine {
  if (inspection.due) return { text: t('partDetail.inspectDue'), tone: 'inspect' };
  const { kmLeft, monthsLeft } = inspection;
  if (kmLeft != null && monthsLeft != null) {
    return {
      text: t('partDetail.inspectIn', {
        km: formatNumber(kmLeft, language),
        months: formatNumber(monthsLeft, language),
      }),
      tone: 'secondary',
    };
  }
  if (kmLeft != null) {
    return {
      text: t('parts.inspectInKm', { km: formatNumber(kmLeft, language) }),
      tone: 'secondary',
    };
  }
  return {
    text: t('parts.inspectInMonths', { months: formatNumber(monthsLeft ?? 0, language) }),
    tone: 'secondary',
  };
}

/**
 * Крупная строка остатка. Кольцо строится по километрам, если километровый интервал
 * задан, поэтому здесь та же развилка: `basis === 'km'` — километры, иначе месяцы.
 * Замер износа тоже даёт километры, если скорость износа известна, а у детали, которую
 * только осматривают, крупной строкой идёт срок проверки.
 */
function describeKm(resource: Resource, language: Language, t: Translate): StateLine {
  if (resource.status === 'no-data') return { text: t('parts.noData'), tone: 'tertiary' };
  if (resource.basis === 'inspection' && resource.inspection) {
    const line = describeInspection(resource.inspection, language, t);
    return { ...line, tone: line.tone === 'secondary' ? 'primary' : line.tone };
  }
  if (resource.basis === 'wear' && resource.kmLeft == null && resource.wear) {
    return {
      text: t('partDetail.wearNow', { mm: formatDecimal(resource.wear.estimated, language) }),
      tone: resource.status === 'overdue' ? 'danger' : 'primary',
    };
  }
  if ((resource.basis === 'km' || resource.basis === 'wear') && resource.kmLeft != null) {
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
  if (resource.basis !== 'km' && resource.basis !== 'wear') return null;
  if (resource.monthsLeft == null) return null;
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
  scopeBlock: {
    gap: spacing.xxs,
  },
  /** Пояснение переносится на две-три строки — без межстрочного они слипаются. */
  scopeHint: {
    lineHeight: typography.caption.fontSize * lineHeight.relaxed,
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
  /** Комментарий переносится — без собственного межстрочного он слипается. */
  historyNote: {
    lineHeight: typography.label.fontSize * lineHeight.relaxed,
  },
  lastChange: {
    fontFamily: fonts.uiSemibold,
    fontSize: LAST_CHANGE_SIZE,
  },
  /** Та же зона нажатия, что у стрелки «назад», — шапка остаётся симметричной. */
  pinButton: {
    alignItems: 'center',
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
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
  sheetSection: {
    paddingTop: spacing.sm,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
});
