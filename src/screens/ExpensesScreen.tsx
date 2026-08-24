import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react-native';
import { AppText, BottomSheet, Card, MonoText, SectionHeader } from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, radius, sizes, spacing, typography } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { listRecordsWithItems } from '../db/repositories';
import { currentLanguage } from '../i18n';
import { formatNumber, monthIndex, yearOf } from '../lib/format';
import { CATEGORY_KEYS, type CategoryKey, type ServiceRecordWithItems } from '../domain/types';

/**
 * Разбивка расходов. Считается на лету из записей ТО активной машины: отдельной таблицы
 * агрегатов нет — записей на машину десятки, а любой кэш пришлось бы инвалидировать после
 * каждой правки истории.
 *
 * Ключевое место — «нераспределённое». Стоимость позиций раскладывается по категориям, а
 * разница между итоговой суммой за ТО и суммой позиций категории не имеет и уходит
 * отдельной строкой (раздел 4 спецификации).
 */

/** Максимальная высота столбца диаграммы; ниже — минимальная полоска нулевого месяца. */
const BAR_MAX = 110;
const BAR_MIN = 3;
const BAR_GAP = 5;
const BAR_RADIUS = 6;
/** Столбцы с ненулевой суммой не должны выглядеть как «ничего». */
const BAR_MIN_VISIBLE = 6;

/** Прозрачность неподсвеченных столбцов — в макете это accent с альфой 0x66. */
const BAR_DIM_OPACITY = 0.4;

/** `all` — «за всё время», число — конкретный год. */
type Period = number | 'all';

interface CategoryRow {
  key: string;
  label: string;
  amount: number;
  /** Строка «нераспределённое» рисуется приглушённым цветом. */
  muted: boolean;
}

interface Summary {
  total: number;
  /** Сколько записей ТО попало в период — от него же считается средний чек. */
  count: number;
  unallocated: number;
  byCategory: Record<CategoryKey, number>;
}

function emptyByCategory(): Record<CategoryKey, number> {
  const result = {} as Record<CategoryKey, number>;
  for (const key of CATEGORY_KEYS) result[key] = 0;
  return result;
}

/** Сумма позиций записи: считаются только те, у которых цена указана. */
function itemsSumOf(record: ServiceRecordWithItems): number {
  let sum = 0;
  for (const item of record.items) if (item.cost !== null) sum += item.cost;
  return sum;
}

export default function ExpensesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Высота таб-бара вместе с системной зоной: без неё разбивка по категориям уезжает под навигацию.
  const tabBarHeight = useBottomTabBarHeight();
  const { activeCar, revision } = useGarage();
  const language = currentLanguage();

  const [records, setRecords] = useState<ServiceRecordWithItems[]>([]);
  const [period, setPeriod] = useState<Period>(() => new Date().getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);

  const carId = activeCar?.id ?? null;

  useEffect(() => {
    if (!carId) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    void listRecordsWithItems(carId).then((loaded) => {
      if (!cancelled) setRecords(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [carId, revision]);

  /** Годы, за которые вообще есть история, от свежих к старым. */
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const record of records) set.add(yearOf(record.date));
    return [...set].sort((a, b) => b - a);
  }, [records]);

  // Текущий год по умолчанию, но если истории за него нет — показываем самый свежий.
  useEffect(() => {
    if (years.length === 0) return;
    setPeriod((current) => (current === 'all' || years.includes(current) ? current : years[0]));
  }, [years]);

  const summary = useMemo<Summary>(() => {
    const byCategory = emptyByCategory();
    let total = 0;
    let unallocated = 0;
    let count = 0;

    for (const record of records) {
      if (period !== 'all' && yearOf(record.date) !== period) continue;
      count += 1;

      let itemsSum = 0;
      for (const item of record.items) {
        if (item.cost === null) continue;
        itemsSum += item.cost;
        byCategory[item.categoryKey] = (byCategory[item.categoryKey] ?? 0) + item.cost;
      }

      total += record.totalCost ?? itemsSum;
      if (record.totalCost !== null) {
        const rest = record.totalCost - itemsSum;
        if (rest > 0) unallocated += rest;
      }
    }

    return { total, count, unallocated, byCategory };
  }, [records, period]);

  /**
   * Диаграмма всегда про конкретный год: для «всего времени» берём самый свежий год
   * с историей, иначе подпись «по месяцам» было бы не к чему привязать.
   */
  const chartYear = useMemo(
    () => (period === 'all' ? (years[0] ?? new Date().getFullYear()) : period),
    [period, years],
  );

  const chart = useMemo(() => {
    const sums = new Array<number>(12).fill(0);
    for (const record of records) {
      if (yearOf(record.date) !== chartYear) continue;
      sums[monthIndex(record.date)] += record.totalCost ?? itemsSumOf(record);
    }
    const max = Math.max(...sums);
    const now = new Date();
    // В текущем году подсвечиваем текущий месяц, в прошлых — самый дорогой.
    const highlight = chartYear === now.getFullYear() ? now.getMonth() : sums.indexOf(max);
    return { sums, max, highlight };
  }, [records, chartYear]);

  const monthLabels = useMemo(() => {
    const raw: unknown = t('months.short', { returnObjects: true });
    return Array.isArray(raw) ? raw.map((item) => String(item)) : [];
  }, [t]);

  const categoryRows = useMemo<CategoryRow[]>(() => {
    const rows: CategoryRow[] = CATEGORY_KEYS.filter((key) => summary.byCategory[key] > 0)
      .map((key) => ({
        key,
        label: t(`category.${key}`),
        amount: summary.byCategory[key],
        muted: false,
      }))
      .sort((a, b) => b.amount - a.amount);

    if (summary.unallocated > 0) {
      rows.push({
        key: 'unallocated',
        label: t('expenses.unallocated'),
        amount: summary.unallocated,
        muted: true,
      });
    }
    return rows;
  }, [summary, t]);

  const categoryMax = useMemo(
    () => categoryRows.reduce((max, row) => Math.max(max, row.amount), 0),
    [categoryRows],
  );

  const periodLabel = period === 'all' ? t('expenses.allTime') : String(period);
  const totalLabel =
    period === 'all' ? t('expenses.spentAllTime') : t('expenses.spentIn', { year: String(period) });
  const average = summary.count > 0 ? summary.total / summary.count : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.appBar}>
        <AppText variant="title" numberOfLines={1} style={styles.appBarTitle}>
          {t('expenses.title')}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <MonoText weight="semibold" size={14}>
            {periodLabel}
          </MonoText>
          <ChevronDown size={15} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: sizes.screenPadding + tabBarHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.totalBlock}>
          <AppText variant="sectionLabel">{totalLabel}</AppText>
          <MonoText weight="bold" size={36}>
            {formatNumber(summary.total, language)}
          </MonoText>
          <AppText variant="caption" tone="secondary">
            {`${t('records.count', { count: summary.count })} · ${t('expenses.average', {
              amount: formatNumber(average, language),
            })}`}
          </AppText>
        </View>

        {summary.total === 0 ? (
          <Card style={styles.emptyCard}>
            <AppText variant="bodyMedium">{t('expenses.empty')}</AppText>
            <AppText variant="caption" tone="secondary" style={styles.emptyHint}>
              {t('expenses.emptyHint')}
            </AppText>
          </Card>
        ) : (
          <>
            <Card padding={16} style={styles.chartCard}>
              <View style={styles.bars}>
                {chart.sums.map((value, index) => {
                  const zero = value <= 0;
                  const height = zero
                    ? BAR_MIN
                    : Math.max(BAR_MIN_VISIBLE, Math.round((value / chart.max) * BAR_MAX));
                  return (
                    <View key={index} style={styles.column}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height,
                            backgroundColor: zero ? colors.border : colors.accent,
                            opacity: zero || index === chart.highlight ? 1 : BAR_DIM_OPACITY,
                          },
                        ]}
                      />
                      <AppText numberOfLines={1} tone="tertiary" style={styles.monthLabel}>
                        {monthLabels[index] ?? ''}
                      </AppText>
                    </View>
                  );
                })}
              </View>
              <AppText tone="tertiary" style={styles.chartCaption}>
                {t('expenses.byMonth', { year: String(chartYear) })}
              </AppText>
            </Card>

            <View style={styles.categoriesSection}>
              <SectionHeader title={t('expenses.byCategory')} />
              <Card padding={14} radius={radius.xl} style={styles.categoriesCard}>
                {categoryRows.map((row) => (
                  <View key={row.key} style={styles.categoryRow}>
                    <View style={styles.categoryHead}>
                      <AppText numberOfLines={1} style={styles.categoryName}>
                        {row.label}
                      </AppText>
                      <MonoText weight="semibold" size={14}>
                        {formatNumber(row.amount, language)}
                      </MonoText>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={[
                          styles.trackFill,
                          {
                            backgroundColor: row.muted ? colors.muted : colors.accent,
                            width: `${categoryMax > 0 ? (row.amount / categoryMax) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
                {summary.unallocated > 0 ? (
                  <AppText tone="tertiary" style={styles.categoryNote}>
                    {t('expenses.unallocatedHint')}
                  </AppText>
                ) : null}
              </Card>
            </View>
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('expenses.period')}
      >
        <View style={styles.sheetList}>
          {years.map((value) => (
            <PeriodOption
              key={value}
              label={String(value)}
              mono
              selected={period === value}
              onPress={() => {
                setPeriod(value);
                setPickerOpen(false);
              }}
            />
          ))}
          <PeriodOption
            label={t('expenses.allTime')}
            selected={period === 'all'}
            onPress={() => {
              setPeriod('all');
              setPickerOpen(false);
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

interface PeriodOptionProps {
  label: string;
  selected: boolean;
  mono?: boolean;
  onPress: () => void;
}

function PeriodOption({ label, selected, mono = false, onPress }: PeriodOptionProps) {
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
      {mono ? (
        <MonoText weight="semibold" size={15}>
          {label}
        </MonoText>
      ) : (
        <AppText variant="bodyMedium">{label}</AppText>
      )}
      {selected ? <Check size={sizes.iconMd} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  appBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: sizes.appBarHeight,
    justifyContent: 'space-between',
    paddingHorizontal: sizes.screenPadding,
  },
  appBarTitle: {
    flexShrink: 1,
  },
  pill: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: sizes.border,
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  content: {
    gap: sizes.screenPadding,
    padding: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  totalBlock: {
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  emptyCard: {
    gap: spacing.s,
  },
  emptyHint: {
    lineHeight: typography.caption.fontSize * 1.45,
  },
  chartCard: {
    gap: spacing.md,
  },
  bars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: BAR_GAP,
  },
  column: {
    alignItems: 'stretch',
    flex: 1,
    gap: 7,
  },
  bar: {
    borderRadius: BAR_RADIUS,
  },
  monthLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  chartCaption: {
    fontSize: 11,
  },
  categoriesSection: {
    gap: 9,
  },
  categoriesCard: {
    gap: 13,
  },
  categoryRow: {
    gap: 7,
  },
  categoryHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  categoryName: {
    flexShrink: 1,
    fontSize: 14,
  },
  track: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    borderRadius: 3,
    height: '100%',
  },
  categoryNote: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    lineHeight: 11.5 * 1.45,
  },
  sheetList: {
    paddingHorizontal: sizes.screenPadding,
    paddingBottom: spacing.sm,
  },
  sheetRow: {
    alignItems: 'center',
    borderBottomWidth: sizes.border,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
});
