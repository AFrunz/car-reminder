import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Check, ListChecks, Plus } from 'lucide-react-native';

import {
  AppBar,
  AppText,
  BottomSheet,
  CarAppBar,
  IconButton,
  PartRow,
  SectionHeader,
  type TextTone,
} from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { layout, sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { lastChangesForCar, listParts, listRecords, todayIso } from '../db/repositories';
import { baselineForCar, calculateResource, type Resource } from '../domain/resource';
import { effectiveMileage } from '../domain/validation';
import { CATEGORY_KEYS, type Car, type CategoryKey, type Part } from '../domain/types';
import { formatNumber, formatSigned } from '../lib/format';
import { currentLanguage } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

/** Зазор между секциями списка — из макета «02 · Запчасти». */
const SECTION_GAP = 10;

type PartsNavigation = NativeStackNavigationProp<RootStackParamList>;

interface PartResource {
  part: Part;
  resource: Resource;
}

interface Subtitle {
  text: string;
  tone: TextTone;
}

const carTitle = (car: Car): string => `${car.make} ${car.model}`;

export default function PartsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Высота таб-бара вместе с системной зоной: без неё последняя строка уезжает под навигацию.
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<PartsNavigation>();
  const { activeCar, cars, setActiveCar, revision, loading: garageLoading } = useGarage();
  const language = currentLanguage();

  const [items, setItems] = useState<PartResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Partial<Record<CategoryKey, boolean>>>({});
  const [carSheetVisible, setCarSheetVisible] = useState(false);

  const carId = activeCar?.id;
  // Пробег входит в зависимости отдельно: после его обновления ресурс всех деталей меняется.
  const carMileage = activeCar?.mileage;
  // Год выпуска — точка отсчёта для деталей, которые ни разу не меняли.
  const carYear = activeCar?.year;

  useEffect(() => {
    if (carId === undefined || carMileage === undefined || carYear === undefined) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [parts, changes, records] = await Promise.all([
        listParts(carId, true),
        lastChangesForCar(carId),
        listRecords(carId),
      ]);
      if (cancelled) return;
      const mileage = effectiveMileage(carMileage, records);
      const today = todayIso();
      const baseline = baselineForCar({ year: carYear });
      setItems(
        parts.map((part) => ({
          part,
          resource: calculateResource(part, changes[part.id] ?? null, mileage, today, baseline),
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [carId, carMileage, carYear, revision]);

  /** У каталожной детали своего имени нет — оно живёт в переводах под `catalog.<ключ>`. */
  const resolveName = useCallback(
    (part: Part): string =>
      part.name ?? (part.catalogKey ? t(`catalog.${part.catalogKey}`) : t('common.dash')),
    [t],
  );

  /**
   * Подпись под названием — остаток ресурса словами. Для просрочки показываем
   * километровое число (со знаком минус при перепробеге) и слово «просрочено»:
   * цвет здесь означает худшее из двух ограничений, а число — всегда километровое.
   *
   * Прочерк остаётся только у `no-data` — когда у детали не задан ни один интервал и
   * считать попросту нечего. Ресурс, посчитанный от начала жизни машины, показывает
   * обычные числа и тон по статусу, а допущение выдаёт приписка «нет данных».
   */
  const describe = useCallback(
    (resource: Resource): Subtitle => {
      const { status, kmLeft, monthsLeft, assumed } = resource;
      if (status === 'no-data') return { text: t('parts.noData'), tone: 'tertiary' };
      if (assumed) {
        const tone: TextTone =
          status === 'overdue' ? 'danger' : status === 'warn' ? 'warn' : 'secondary';
        // Одно число вместо двух: третьим сегментом строка перестаёт читаться.
        const value =
          kmLeft != null
            ? t('parts.remainingKm', { km: formatSigned(kmLeft, language) })
            : monthsLeft != null
              ? t('parts.remainingMonths', { months: formatSigned(monthsLeft, language) })
              : null;
        if (value === null) return { text: t('parts.noData'), tone: 'tertiary' };
        return { text: t('parts.assumed', { value }), tone };
      }
      if (status === 'overdue') {
        return {
          text:
            kmLeft != null
              ? t('parts.overdueKm', { km: formatSigned(kmLeft, language) })
              : monthsLeft != null
                ? t('parts.overdueMonths', { months: formatSigned(monthsLeft, language) })
                : t('parts.overdue'),
          tone: 'danger',
        };
      }
      const tone: TextTone = status === 'warn' ? 'warn' : 'secondary';
      if (kmLeft != null && monthsLeft != null) {
        return {
          text: t('parts.remaining', {
            km: formatNumber(kmLeft, language),
            months: formatNumber(monthsLeft, language),
          }),
          tone,
        };
      }
      if (kmLeft != null) {
        return { text: t('parts.remainingKm', { km: formatNumber(kmLeft, language) }), tone };
      }
      if (monthsLeft != null) {
        return {
          text: t('parts.remainingMonths', { months: formatNumber(monthsLeft, language) }),
          tone,
        };
      }
      return { text: t('parts.noData'), tone: 'tertiary' };
    },
    [language, t],
  );

  /** Сначала самые критичные: сортировка по возрастанию остатка. */
  const attention = useMemo(
    () =>
      items
        .filter(({ resource }) => resource.status === 'overdue' || resource.status === 'warn')
        .sort((a, b) => (a.resource.value ?? 0) - (b.resource.value ?? 0)),
    [items],
  );

  const groups = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => ({
        key,
        rows: items.filter(({ part }) => part.categoryKey === key),
      })).filter((group) => group.rows.length > 0),
    [items],
  );

  const toggleCategory = useCallback((key: CategoryKey) => {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const renderRow = useCallback(
    (item: PartResource) => {
      const subtitle = describe(item.resource);
      return (
        <PartRow
          key={item.part.id}
          name={resolveName(item.part)}
          subtitle={subtitle.text}
          subtitleTone={subtitle.tone}
          resource={item.resource}
          onPress={() => navigation.navigate('PartDetail', { partId: item.part.id })}
        />
      );
    },
    [describe, navigation, resolveName],
  );

  const actions = (
    <View style={styles.actions}>
      <IconButton
        icon={ListChecks}
        variant="plain"
        accessibilityLabel={t('catalogScreen.title')}
        onPress={() => navigation.navigate('PartsCatalog')}
      />
      <IconButton
        icon={Plus}
        variant="soft"
        accessibilityLabel={t('parts.addCustom')}
        onPress={() => navigation.navigate('PartForm')}
      />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {activeCar ? (
        <CarAppBar
          carName={carTitle(activeCar)}
          onPressCar={() => setCarSheetVisible(true)}
          right={actions}
        />
      ) : (
        <AppBar title={t('tabs.parts')} right={actions} />
      )}

      {loading || garageLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <AppText variant="heading" style={styles.centered}>
            {t('parts.empty')}
          </AppText>
          <AppText tone="secondary" style={styles.centered}>
            {t('parts.emptyHint')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: spacing.xxl + tabBarHeight },
          ]}
        >
          {attention.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('parts.needsAttention')} />
              {attention.map(renderRow)}
            </View>
          ) : null}

          {groups.map((group) => (
            <View key={group.key} style={styles.section}>
              <SectionHeader
                title={t(`category.${group.key}`)}
                collapsible
                collapsed={collapsed[group.key] ?? false}
                onToggle={() => toggleCategory(group.key)}
              />
              {collapsed[group.key] ? null : group.rows.map(renderRow)}
            </View>
          ))}
        </ScrollView>
      )}

      <BottomSheet
        visible={carSheetVisible}
        onClose={() => setCarSheetVisible(false)}
        title={t('common.selectCar')}
      >
        <View style={styles.carList}>
          {cars.map((car) => (
            <Pressable
              key={car.id}
              accessibilityRole="button"
              onPress={() => {
                setActiveCar(car.id);
                setCarSheetVisible(false);
              }}
              style={({ pressed }) => [styles.carRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <AppText variant="bodyMedium" numberOfLines={1} style={styles.carName}>
                {carTitle(car)}
              </AppText>
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
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.s,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: SECTION_GAP,
    paddingBottom: spacing.xxl,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: sizes.screenPadding,
  },
  centered: {
    textAlign: 'center',
  },
  carList: {
    paddingBottom: spacing.sm,
  },
  carRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingVertical: spacing.md,
  },
  carName: {
    flexShrink: 1,
  },
});
