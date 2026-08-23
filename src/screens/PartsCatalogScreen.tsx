import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';

import { AppBar, AppText, Toggle } from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, lineHeight, radius, sizes, spacing, typography } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { listParts, updatePart } from '../db/repositories';
import { CATALOG, isApplicable, inapplicableReason, type CatalogEntry } from '../data/catalog';
import { CATEGORY_KEYS, type Car, type Part } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';

/** Размеры поля поиска и подписей — из макета «04 · Каталог запчастей». */
const SEARCH_HEIGHT = 44;
const SEARCH_ICON = 17;
const SEARCH_GAP = 9;
const SEARCH_PADDING = 13;
const HINT_SIZE = 12.5;
const ROW_PADDING_VERTICAL = 12;
const ROW_PADDING_HORIZONTAL = 14;
const REASON_SIZE = 11.5;

const CATALOG_BY_KEY = new Map<string, CatalogEntry>(CATALOG.map((entry) => [entry.key, entry]));

type Props = NativeStackScreenProps<RootStackParamList, 'PartsCatalog'>;

const carTitle = (car: Car): string => `${car.make} ${car.model}`;

export default function PartsCatalogScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeCar, revision, refresh } = useGarage();

  const [parts, setParts] = useState<Part[]>([]);
  const [query, setQuery] = useState('');

  const carId = activeCar?.id;

  useEffect(() => {
    if (carId === undefined) {
      setParts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = await listParts(carId);
      if (!cancelled) setParts(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [carId, revision]);

  /** У каталожной детали своего имени нет — оно живёт в переводах под `catalog.<ключ>`. */
  const resolveName = useCallback(
    (part: Part): string =>
      part.name ?? (part.catalogKey ? t(`catalog.${part.catalogKey}`) : t('common.dash')),
    [t],
  );

  /** Причина показывается только у позиций, не подходящих этой машине. */
  const resolveReason = useCallback(
    (part: Part): string | null => {
      if (!activeCar || !part.catalogKey) return null;
      const entry = CATALOG_BY_KEY.get(part.catalogKey);
      if (!entry || isApplicable(entry, activeCar.fuel, activeCar.transmission)) return null;
      const reason = inapplicableReason(entry);
      return reason ? t(`reason.${reason}`) : null;
    },
    [activeCar, t],
  );

  /**
   * Состояние обновляется оптимистично: запись в базу асинхронная, и без этого
   * тумблер оставался бы в старом положении до перезагрузки списка.
   */
  const setTracked = useCallback(
    (id: string, tracked: boolean) => {
      setParts((current) =>
        current.map((part) => (part.id === id ? { ...part, tracked } : part)),
      );
      void (async () => {
        await updatePart(id, { tracked });
        refresh();
      })();
    },
    [refresh],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible =
      needle.length === 0
        ? parts
        : parts.filter((part) => resolveName(part).toLowerCase().includes(needle));
    return CATEGORY_KEYS.map((key) => ({
      key,
      rows: visible.filter((part) => part.categoryKey === key),
    })).filter((group) => group.rows.length > 0);
  }, [parts, query, resolveName]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar title={t('catalogScreen.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Search size={SEARCH_ICON} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('catalogScreen.search')}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
        </View>

        <AppText tone="tertiary" style={styles.hint}>
          {t('catalogScreen.hint', { car: activeCar ? carTitle(activeCar) : '' })}
        </AppText>

        {groups.length === 0 ? (
          <AppText tone="secondary" style={styles.empty}>
            {t('catalogScreen.empty')}
          </AppText>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <AppText variant="sectionLabel" numberOfLines={1}>
                {t(`category.${group.key}`)}
              </AppText>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {group.rows.map((part, index) => {
                  const reason = resolveReason(part);
                  const last = index === group.rows.length - 1;
                  return (
                    <View
                      key={part.id}
                      style={[
                        styles.row,
                        !last && { borderBottomColor: colors.border, borderBottomWidth: sizes.border },
                      ]}
                    >
                      <View style={styles.rowText}>
                        <AppText
                          variant="bodyMedium"
                          tone={part.tracked ? 'primary' : 'tertiary'}
                          numberOfLines={2}
                        >
                          {resolveName(part)}
                        </AppText>
                        {reason ? (
                          <AppText tone="tertiary" style={styles.reason}>
                            {reason}
                          </AppText>
                        ) : null}
                      </View>
                      <Toggle
                        value={part.tracked}
                        onChange={(value) => setTracked(part.id, value)}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  search: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: sizes.border,
    flexDirection: 'row',
    gap: SEARCH_GAP,
    height: SEARCH_HEIGHT,
    paddingHorizontal: SEARCH_PADDING,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: typography.body.fontSize,
    padding: 0,
  },
  hint: {
    fontSize: HINT_SIZE,
    lineHeight: HINT_SIZE * lineHeight.relaxed,
  },
  empty: {
    paddingVertical: spacing.xl,
    textAlign: 'center',
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
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingHorizontal: ROW_PADDING_HORIZONTAL,
    paddingVertical: ROW_PADDING_VERTICAL,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  reason: {
    fontSize: REASON_SIZE,
  },
});
