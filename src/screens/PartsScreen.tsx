import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { ListChecks, Plus } from 'lucide-react-native';

import {
  AppBar,
  AppText,
  CarAppBar,
  CarPickerSheet,
  IconButton,
  PartRow,
  SectionHeader,
} from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { listParts, listRecords, partEventsForCar, todayIso } from '../db/repositories';
import {
  baselineForCar,
  byUrgency,
  resourceForPart,
  summarizePartEvents,
  type Resource,
} from '../domain/resource';
import { effectiveMileage } from '../domain/validation';
import { CATEGORY_KEYS, type Car, type CategoryKey, type Part } from '../domain/types';
import { describeResource } from '../lib/resourceText';
import { currentLanguage } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

/** Зазор между секциями списка — из макета «02 · Запчасти». */
const SECTION_GAP = 10;

type PartsNavigation = NativeStackNavigationProp<RootStackParamList>;

interface PartResource {
  part: Part;
  resource: Resource;
}

const carTitle = (car: Car): string => `${car.make} ${car.model}`;

/** Сначала самые критичные: просрочка, проверка, «скоро менять», затем по остатку. */
const byRemaining = (a: PartResource, b: PartResource): number =>
  byUrgency(a.resource, b.resource);

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
      const [parts, events, records] = await Promise.all([
        listParts(carId, true),
        partEventsForCar(carId),
        listRecords(carId),
      ]);
      if (cancelled) return;
      const mileage = effectiveMileage(carMileage, records);
      const today = todayIso();
      const baseline = baselineForCar({ year: carYear });
      const histories = summarizePartEvents(events);
      setItems(
        parts.map((part) => ({
          part,
          resource: resourceForPart(part, histories[part.id], mileage, today, baseline),
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

  const describe = useCallback(
    (resource: Resource) => describeResource(resource, language, t),
    [language, t],
  );

  /**
   * Раскладка списка по секциям. Приоритет — «Избранное» → «Требует внимания» → категории:
   * деталь занимает первую подходящую секцию и ниже по списку уже не повторяется, поэтому
   * закреплённая просрочка видна только в избранном, а внимание не дублируется категорией.
   */
  const { pinned, attention, groups } = useMemo(() => {
    const pinnedRows: PartResource[] = [];
    const attentionRows: PartResource[] = [];
    const rest: PartResource[] = [];
    for (const item of items) {
      if (item.part.pinned) {
        pinnedRows.push(item);
      } else if (
        item.resource.status === 'overdue' ||
        item.resource.status === 'inspect' ||
        item.resource.status === 'warn'
      ) {
        attentionRows.push(item);
      } else {
        rest.push(item);
      }
    }
    return {
      pinned: pinnedRows.sort(byRemaining),
      attention: attentionRows.sort(byRemaining),
      groups: CATEGORY_KEYS.map((key) => ({
        key,
        rows: rest.filter(({ part }) => part.categoryKey === key),
      })).filter((group) => group.rows.length > 0),
    };
  }, [items]);

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
          {/* Пустое избранное секции не заводит: заголовок без строк — просто шум. */}
          {pinned.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t('parts.pinned')} />
              {pinned.map(renderRow)}
            </View>
          ) : null}

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

      <CarPickerSheet
        visible={carSheetVisible}
        onClose={() => setCarSheetVisible(false)}
        cars={cars}
        activeCarId={activeCar?.id ?? null}
        onSelect={setActiveCar}
        onAddCar={() => navigation.navigate('CarForm')}
      />
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
});
