import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Plus } from 'lucide-react-native';

import {
  AppBar,
  AppText,
  Badge,
  BottomSheet,
  Card,
  CarAppBar,
  Field,
  IconButton,
  MonoText,
  PrimaryButton,
  ProgressBar,
  SectionHeader,
} from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fontSize, layout, radius, sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { todayIso } from '../db/database';
import {
  deleteRecord,
  lastScheduledService,
  listParts,
  listRecordsWithItems,
  updateCar,
} from '../db/repositories';
import { baselineForCar, calculateNextService, type LastChange } from '../domain/resource';
import { effectiveMileage, validateMileageUpdate } from '../domain/validation';
import type { Car, Part, ServiceItem, ServiceRecordWithItems } from '../domain/types';
import { formatDate, formatNumber, parseNumberInput } from '../lib/format';
import type { Language } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

/**
 * Стартовая вкладка: текущий пробег, следующее регулярное ТО и история записей.
 * Кольцо-бублик здесь намеренно не рисуется — оно закреплено за остаточным ресурсом
 * деталей, и плановое ТО показывается линейной полосой.
 *
 * Кегли, которых нет в общей типографической шкале, сняты с макета «01 · ТО».
 */
const TYPE = {
  odometer: 32,
  distance: 22,
  recordMileage: 17,
  recordTotal: 15,
  partName: 13.5,
  recordDate: 12.5,
  totalLabel: 12,
  note: 11,
  pill: 13,
} as const;

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const carTitle = (car: Car): string => `${car.make} ${car.model}`;

/**
 * Комментарий к позиции: модель, артикул, любое уточнение. Пустую строку из формы
 * считаем отсутствием комментария, иначе под названием повисла бы пустая строка.
 */
const itemNote = (item: ServiceItem): string | null => {
  const note = item.note?.trim();
  return note ? note : null;
};

/* ── Карточка одной записи ТО ───────────────────────────────────────────── */

interface RecordCardProps {
  record: ServiceRecordWithItems;
  /** Разрешённые названия деталей: у позиции-детали своего имени нет. */
  partNames: Map<string, string>;
  language: Language;
  onPress: () => void;
  onLongPress: () => void;
}

function RecordCard({ record, partNames, language, onPress, onLongPress }: RecordCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const parts = record.items.filter((item) => item.type === 'part');
  const services = record.items.filter((item) => item.type === 'service');
  const serviceList = services
    .map((item) => item.name ?? t(`category.${item.categoryKey}`))
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card padding={0} radius={radius.xl + 2} style={styles.recordCard}>
        <View style={styles.recordHead}>
          <View style={styles.recordMeta}>
            <MonoText weight="bold" size={TYPE.recordMileage}>
              {t('units.kmValue', { value: formatNumber(record.mileage, language) })}
            </MonoText>
            <AppText tone="secondary" style={styles.recordDate}>
              {formatDate(record.date, language)}
            </AppText>
          </View>
          <Badge
            label={t(record.kind === 'scheduled' ? 'records.scheduled' : 'records.unscheduled')}
            tone={record.kind === 'scheduled' ? 'accent' : 'neutral'}
          />
        </View>

        {parts.length > 0 || services.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.recordBody}>
              {parts.map((item) => {
                // Комментарий уходит второй строкой: у детали название легко занимает всю
                // ширину, и приписка через разделитель ломала бы его переносом.
                const note = itemNote(item);
                return (
                  <View key={item.id} style={styles.partRow}>
                    <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
                    <View style={styles.partText}>
                      <AppText style={styles.partName}>
                        {(item.partId ? partNames.get(item.partId) : null) ??
                          item.name ??
                          t('common.dash')}
                      </AppText>
                      {note ? (
                        <AppText tone="tertiary" numberOfLines={2} style={styles.partNote}>
                          {note}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {services.length > 0 ? (
                <AppText tone="secondary" style={styles.servicesLine}>
                  {t('records.services', { list: serviceList })}
                </AppText>
              ) : null}
            </View>
          </>
        ) : null}

        {record.totalCost != null ? (
          <View style={[styles.recordFooter, { backgroundColor: colors.surfaceAlt }]}>
            <AppText tone="secondary" style={styles.totalLabel}>
              {t('records.total')}
            </AppText>
            <MonoText weight="bold" size={TYPE.recordTotal}>
              {formatNumber(record.totalCost, language)}
            </MonoText>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

/* ── Экран ──────────────────────────────────────────────────────────────── */

export default function ServiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Высота таб-бара вместе с системной зоной: без неё последняя карточка уезжает под навигацию.
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<Navigation>();
  const { t, i18n } = useTranslation();
  const language: Language = i18n.language === 'ru' ? 'ru' : 'en';

  const { activeCar, cars, setActiveCar, refresh, revision, loading: garageLoading } = useGarage();
  const carId = activeCar?.id ?? null;

  const [records, setRecords] = useState<ServiceRecordWithItems[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [lastScheduled, setLastScheduled] = useState<LastChange | null>(null);
  const [loading, setLoading] = useState(true);

  const [sheet, setSheet] = useState<'none' | 'mileage' | 'cars'>('none');
  const [mileageInput, setMileageInput] = useState('');
  const [mileageError, setMileageError] = useState<string | null>(null);

  useEffect(() => {
    if (!carId) {
      setRecords([]);
      setParts([]);
      setLastScheduled(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [loadedRecords, loadedParts, scheduled] = await Promise.all([
        listRecordsWithItems(carId),
        listParts(carId),
        lastScheduledService(carId),
      ]);
      if (cancelled) return;
      setRecords(loadedRecords);
      setParts(loadedParts);
      setLastScheduled(scheduled);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [carId, revision]);

  /** Каталожные детали локализуются по ключу, переименованные — своим именем. */
  const partNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const part of parts) {
      map.set(part.id, part.name ?? (part.catalogKey ? t(`catalog.${part.catalogKey}`) : ''));
    }
    return map;
  }, [parts, t]);

  const mileage = activeCar ? effectiveMileage(activeCar.mileage, records) : 0;

  const nextService = activeCar
    ? calculateNextService(
        activeCar.serviceIntervalKm,
        activeCar.serviceIntervalMonths,
        lastScheduled,
        mileage,
        todayIso(),
        baselineForCar(activeCar),
      )
    : null;

  const openMileageSheet = useCallback(() => {
    setMileageInput(String(mileage));
    setMileageError(null);
    setSheet('mileage');
  }, [mileage]);

  const saveMileage = useCallback(() => {
    if (!activeCar) return;
    const value = parseNumberInput(mileageInput);
    if (value == null) {
      setMileageError(t('validation.mileage-not-positive'));
      return;
    }
    const errors = validateMileageUpdate(value, records);
    const error = errors[0];
    if (error) {
      const conflict = error.conflictsWith;
      setMileageError(
        conflict
          ? t(`validation.${error.code}`, {
              mileage: formatNumber(conflict.mileage, language),
              date: formatDate(conflict.date, language),
            })
          : t(`validation.${error.code}`),
      );
      return;
    }
    void (async () => {
      await updateCar(activeCar.id, { mileage: value });
      setSheet('none');
      refresh();
    })();
  }, [activeCar, mileageInput, records, language, refresh, t]);

  const confirmDelete = useCallback(
    (recordId: string) => {
      Alert.alert(t('recordForm.deleteConfirm'), t('recordForm.deleteWarning'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteRecord(recordId);
              refresh();
            })();
          },
        },
      ]);
    },
    [refresh, t],
  );

  const renderRecord = useCallback(
    ({ item }: ListRenderItemInfo<ServiceRecordWithItems>) => (
      <RecordCard
        record={item}
        partNames={partNames}
        language={language}
        onPress={() => navigation.navigate('RecordForm', { recordId: item.id })}
        onLongPress={() => confirmDelete(item.id)}
      />
    ),
    [partNames, language, navigation, confirmDelete],
  );

  /* ── Гараж пуст: предлагаем завести первую машину ─────────────────────── */

  if (!garageLoading && cars.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <AppBar title={t('tabs.service')} />
        <View style={styles.placeholder}>
          <AppText variant="heading" style={styles.placeholderTitle}>
            {t('garage.empty')}
          </AppText>
          <AppText tone="secondary" style={styles.placeholderHint}>
            {t('garage.emptyHint')}
          </AppText>
          <PrimaryButton
            title={t('settings.addCar')}
            icon={Plus}
            onPress={() => navigation.navigate('CarForm')}
          />
        </View>
      </View>
    );
  }

  const busy = garageLoading || loading;

  const header = (
    <View style={styles.header}>
      {/* Текущий пробег — от него считается всё остальное, поэтому он первый. */}
      <Card style={styles.odometerCard}>
        <View style={styles.odometerText}>
          <AppText variant="sectionLabel">{t('service.currentMileage')}</AppText>
          <View style={styles.odometerValueRow}>
            <MonoText weight="bold" size={TYPE.odometer}>
              {formatNumber(mileage, language)}
            </MonoText>
            <AppText tone="secondary">{t('units.km')}</AppText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('service.updateMileage')}
          onPress={openMileageSheet}
          style={({ pressed }) => [
            styles.updatePill,
            { backgroundColor: colors.accentSoft, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Pencil size={sizes.iconXs + 1} color={colors.accent} />
          <AppText tone="accent" style={styles.updatePillLabel}>
            {t('common.update')}
          </AppText>
        </Pressable>
      </Card>

      {/* Регулярных ТО может не быть вовсе — тогда карточки нет. */}
      {nextService ? (
        <Card style={styles.nextCard}>
          <View style={styles.nextTopRow}>
            <View style={styles.nextLeft}>
              <AppText tone="secondary" style={styles.nextCaption}>
                {t('service.next')}
              </AppText>
              {/* Регулярных ТО могло не быть ни разу — числа всё равно считаем, от нуля. */}
              <MonoText
                weight="bold"
                size={TYPE.distance}
                tone={nextService.status === 'overdue' ? 'danger' : 'primary'}
              >
                {nextService.kmLeft != null
                  ? nextService.kmLeft < 0
                    ? t('service.overdueByKm', {
                        km: formatNumber(Math.abs(nextService.kmLeft), language),
                      })
                    : t('service.inKm', { km: formatNumber(nextService.kmLeft, language) })
                  : nextService.monthsLeft != null && nextService.monthsLeft >= 0
                    ? t('service.inMonths', {
                        count: nextService.monthsLeft,
                        months: formatNumber(nextService.monthsLeft, language),
                      })
                    : t('service.overdue')}
              </MonoText>
            </View>
            {nextService.monthsLeft != null ? (
              <AppText
                tone={nextService.monthsLeft < 0 ? 'danger' : 'tertiary'}
                style={styles.nextMonths}
              >
                {nextService.monthsLeft < 0
                  ? t('service.overdue')
                  : t('service.orMonths', {
                      count: nextService.monthsLeft,
                      months: formatNumber(nextService.monthsLeft, language),
                    })}
              </AppText>
            ) : null}
          </View>

          <ProgressBar value={nextService.value ?? 0} status={nextService.status} />

          {nextService.assumed ? (
            <AppText tone="tertiary" style={styles.nextAssumed}>
              {t('service.assumedHint')}
            </AppText>
          ) : null}

          {lastScheduled || nextService.dueAtMileage != null ? (
            <View style={styles.nextBottomRow}>
              <MonoText tone="tertiary" size={TYPE.note}>
                {lastScheduled
                  ? t('service.lastService', {
                      mileage: formatNumber(lastScheduled.mileage, language),
                    })
                  : ''}
              </MonoText>
              <MonoText tone="tertiary" size={TYPE.note}>
                {nextService.dueAtMileage != null
                  ? t('service.dueAt', {
                      mileage: formatNumber(nextService.dueAtMileage, language),
                    })
                  : ''}
              </MonoText>
            </View>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={t('records.history')} style={styles.historyHeader} />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <CarAppBar
        carName={activeCar ? carTitle(activeCar) : t('tabs.service')}
        onPressCar={() => {
          if (cars.length > 1) setSheet('cars');
        }}
        right={
          <IconButton
            icon={Plus}
            variant="soft"
            accessibilityLabel={t('records.add')}
            onPress={() => navigation.navigate('RecordForm')}
          />
        }
      />

      {busy ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        /*
         * Тап по пустому месту снимает фокус с поля ввода. Обёртка не забирает нажатия у
         * карточек и кнопок: ответчиком становится самый глубокий Pressable, а скролл
         * отбирает жест по движению, поэтому обычный тап и долгое нажатие целы.
         */
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.listWrap}>
          <FlatList
            data={records}
            keyExtractor={(item) => item.id}
            renderItem={renderRecord}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.emptyRecords}>
                <AppText variant="bodyMedium">{t('records.empty')}</AppText>
                <AppText tone="secondary" style={styles.placeholderHint}>
                  {t('records.emptyHint')}
                </AppText>
                <PrimaryButton
                  title={t('records.add')}
                  icon={Plus}
                  onPress={() => navigation.navigate('RecordForm')}
                />
              </View>
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.md + tabBarHeight },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </Pressable>
      )}

      {/* Ввод пробега: меньше максимума из истории поставить нельзя. */}
      <BottomSheet
        visible={sheet === 'mileage'}
        onClose={() => setSheet('none')}
        title={t('service.updateMileage')}
        footer={<PrimaryButton title={t('common.save')} fullWidth onPress={saveMileage} />}
      >
        <View style={styles.sheetBody}>
          <Field
            value={mileageInput}
            onChangeText={(value) => {
              setMileageInput(value);
              setMileageError(null);
            }}
            keyboardType="number-pad"
            suffix={t('units.km')}
            mono
          />
          {mileageError ? (
            <AppText variant="caption" tone="danger">
              {mileageError}
            </AppText>
          ) : (
            <AppText variant="caption" tone="tertiary">
              {t('service.mileageHint')}
            </AppText>
          )}
        </View>
      </BottomSheet>

      {/* Выбор машины — только когда их больше одной. */}
      <BottomSheet
        visible={sheet === 'cars'}
        onClose={() => setSheet('none')}
        title={t('common.selectCar')}
      >
        <View style={[styles.carList, { paddingBottom: spacing.md }]}>
          {cars.map((car) => (
            <Pressable
              key={car.id}
              accessibilityRole="button"
              onPress={() => {
                setActiveCar(car.id);
                setSheet('none');
              }}
              style={({ pressed }) => [styles.carOption, { opacity: pressed ? 0.7 : 1 }]}
            >
              <AppText variant="bodyMedium">{carTitle(car)}</AppText>
              {car.id === activeCar?.id ? (
                <Check size={sizes.iconMd} color={colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm + 2,
    paddingBottom: spacing.md,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  header: {
    gap: spacing.sm + 2,
  },
  placeholder: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: sizes.screenPadding,
  },
  placeholderTitle: {
    textAlign: 'center',
  },
  placeholderHint: {
    textAlign: 'center',
  },
  emptyRecords: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxl,
  },

  /* Текущий пробег */
  odometerCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  odometerText: {
    gap: spacing.s,
  },
  odometerValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.s,
  },
  updatePill: {
    alignItems: 'center',
    borderRadius: radius.sm + 3,
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  updatePillLabel: {
    fontSize: TYPE.pill,
  },

  /* Следующее ТО */
  nextCard: {
    gap: spacing.md + 1,
  },
  nextTopRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextLeft: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  nextCaption: {
    fontSize: fontSize.banner,
  },
  nextMonths: {
    fontSize: fontSize.banner,
  },
  nextAssumed: {
    fontSize: TYPE.note,
  },
  nextBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyHeader: {
    paddingTop: spacing.s,
  },

  /* Запись ТО */
  recordCard: {
    overflow: 'hidden',
  },
  recordHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  recordMeta: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  recordDate: {
    fontSize: TYPE.recordDate,
  },
  divider: {
    height: sizes.border,
    width: '100%',
  },
  recordBody: {
    gap: spacing.s + 1,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  partRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    borderRadius: 2.5,
    height: 5,
    /** Маркер держится первой строки названия, даже когда под ней есть комментарий. */
    marginTop: 6,
    width: 5,
  },
  partText: {
    flex: 1,
    /* Тот же зазор, что у пробега с датой в шапке карточки: пара «название + подпись». */
    gap: spacing.xxs,
  },
  partName: {
    fontSize: TYPE.partName,
  },
  partNote: {
    fontSize: TYPE.note,
  },
  servicesLine: {
    fontSize: TYPE.recordDate,
  },
  recordFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  totalLabel: {
    fontSize: TYPE.totalLabel,
  },

  /* Шторки */
  sheetBody: {
    gap: spacing.md,
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  carList: {
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  carOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
});
