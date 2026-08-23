import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Calculator, Check, Plus, Search, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AppBar,
  AppText,
  Banner,
  BottomSheet,
  Field,
  MonoText,
  OutlineButton,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  SelectField,
  type SegmentOption,
} from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, lineHeight, radius, sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { currentLanguage } from '../i18n';
import { formatNumber, formatShortDate, parseNumberInput } from '../lib/format';
import {
  CATEGORY_KEYS,
  type CategoryKey,
  type Part,
  type ServiceKind,
  type ServiceRecord,
} from '../domain/types';
import { validateServiceRecord, type ValidationError } from '../domain/validation';
import {
  getRecord,
  knownServiceNames,
  listParts,
  listRecords,
  saveRecord,
  todayIso,
  type NewServiceItem,
} from '../db/repositories';
import { COMMON_SERVICES, COMMON_SERVICE_CATEGORY } from '../data/catalog';
import type { RootStackParamList } from '../navigation/types';

/**
 * Добавление и редактирование записи ТО. Позиции (детали и услуги) держатся в состоянии
 * плоскими списками: название детали не копируется, а резолвится из каталога машины —
 * так переключение языка сразу меняет подписи, а в базу уходит ссылка, а не текст.
 */

/* ── Модель формы ───────────────────────────────────────────────────────── */

interface PartEntry {
  partId: string;
  /** Снимок категории детали: именно он уходит в разбивку расходов. */
  categoryKey: CategoryKey;
  cost: number | null;
}

interface ServiceEntry {
  /** Локальный ключ строки — у услуги нет идентификатора до сохранения. */
  key: string;
  name: string;
  categoryKey: CategoryKey;
  cost: number | null;
}

/** Какая позиция сейчас редактируется в шторке цены. */
type CostTarget = { type: 'part'; index: number } | { type: 'service'; index: number };

let serviceKeySeed = 0;
const nextServiceKey = (): string => {
  serviceKeySeed += 1;
  return `service-${serviceKeySeed}`;
};

/* ── Дата ───────────────────────────────────────────────────────────────── */

/** Держит ввод в форме дд.мм.гггг, чтобы не пришлось разбирать произвольный текст. */
function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const chunks = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return chunks.filter((chunk) => chunk.length > 0).join('.');
}

/** дд.мм.гггг → ISO. null означает, что дата ещё не набрана или не существует. */
function parseDateInput(input: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/* ── Мелкие блоки, которых нет в src/ui ─────────────────────────────────── */

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, { opacity: pressed ? 0.7 : 1 }]}
    >
      <AppText tone="accent" style={styles.textActionLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.checkbox,
        checked
          ? { backgroundColor: colors.accent }
          : { borderColor: colors.border, borderWidth: 1.5 },
      ]}
    >
      {checked ? <Check size={14} color={colors.onAccent} /> : null}
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <AppText tone="secondary" style={styles.chipLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}

function SearchInput({ value, onChangeText, placeholder }: SearchInputProps) {
  const colors = useColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.surfaceAlt }]}>
      <Search size={17} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.searchInput, { color: colors.textPrimary }]}
      />
    </View>
  );
}

interface ItemRowProps {
  name: string;
  category: string;
  price: string;
  hasPrice: boolean;
  onPress: () => void;
  onRemove: () => void;
  removeLabel: string;
}

function ItemRow({
  name,
  category,
  price,
  hasPrice,
  onPress,
  onRemove,
  removeLabel,
}: ItemRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.itemRow,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.itemText}>
        <AppText style={styles.itemName}>{name}</AppText>
        <AppText tone="tertiary" style={styles.itemCategory}>
          {category}
        </AppText>
      </View>
      <View style={styles.itemRight}>
        <MonoText tone={hasPrice ? 'secondary' : 'tertiary'} size={13.5}>
          {price}
        </MonoText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          hitSlop={10}
          onPress={onRemove}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <X size={sizes.iconSm} color={colors.textTertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

interface AmountFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  caption: string;
  placeholder: string;
}

/** Поле итоговой суммы: крупная моноширинная цифра и подпись справа внутри рамки. */
function AmountField({ value, onChangeText, caption, placeholder }: AmountFieldProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType="number-pad"
        style={[styles.amountInput, { color: colors.textPrimary }]}
      />
      <AppText tone="tertiary" style={styles.amountCaption}>
        {caption}
      </AppText>
    </View>
  );
}

function CalcButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.calcButton,
        { backgroundColor: colors.accentSoft, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Calculator size={sizes.iconSm} color={colors.accent} />
      <AppText tone="accent" style={styles.calcLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

/* ── Экран ──────────────────────────────────────────────────────────────── */

type Props = NativeStackScreenProps<RootStackParamList, 'RecordForm'>;

export default function RecordFormScreen({ navigation, route }: Props) {
  const recordId = route.params?.recordId;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const language = currentLanguage();
  const { activeCar, refresh } = useGarage();
  const carId = activeCar?.id ?? null;

  /* Данные машины */
  const [parts, setParts] = useState<Part[]>([]);
  const [trackedParts, setTrackedParts] = useState<Part[]>([]);
  const [existingRecords, setExistingRecords] = useState<ServiceRecord[]>([]);
  const [knownServices, setKnownServices] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  /* Поля записи */
  const [dateText, setDateText] = useState(() => formatShortDate(todayIso(), language));
  const [mileageText, setMileageText] = useState('');
  const [kind, setKind] = useState<ServiceKind>('scheduled');
  const [partEntries, setPartEntries] = useState<PartEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [totalText, setTotalText] = useState('');

  /* Ошибки и предупреждения */
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [dateInvalid, setDateInvalid] = useState(false);
  const [zeroPriced, setZeroPriced] = useState<string[]>([]);

  /* Шторка выбора деталей */
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  const [partsQuery, setPartsQuery] = useState('');
  const [partsDraft, setPartsDraft] = useState<string[]>([]);

  /* Шторка новой услуги */
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState<CategoryKey>('engine');
  const [serviceCost, setServiceCost] = useState('');

  /* Шторка цены позиции */
  const [costTarget, setCostTarget] = useState<CostTarget | null>(null);
  const [costText, setCostText] = useState('');

  /** Поля заполняются из записи ровно один раз — иначе перезагрузка затрёт правки. */
  const initialised = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!carId) {
      setLoaded(true);
      return;
    }
    void (async () => {
      const [allParts, tracked, records, names] = await Promise.all([
        listParts(carId),
        listParts(carId, true),
        listRecords(carId),
        knownServiceNames(carId),
      ]);
      const record = recordId ? await getRecord(recordId) : null;
      if (cancelled) return;
      setParts(allParts);
      setTrackedParts(tracked);
      setExistingRecords(records);
      setKnownServices(names);
      if (record && !initialised.current) {
        setDateText(formatShortDate(record.date, language));
        setMileageText(formatNumber(record.mileage, language));
        setKind(record.kind);
        setTotalText(record.totalCost === null ? '' : formatNumber(record.totalCost, language));
        const restoredParts: PartEntry[] = [];
        for (const item of record.items) {
          if (item.type !== 'part' || item.partId === null) continue;
          restoredParts.push({
            partId: item.partId,
            categoryKey: item.categoryKey,
            cost: item.cost,
          });
        }
        setPartEntries(restoredParts);
        setServiceEntries(
          record.items
            .filter((item) => item.type === 'service')
            .map((item) => ({
              key: nextServiceKey(),
              name: item.name ?? '',
              categoryKey: item.categoryKey,
              cost: item.cost,
            })),
        );
      }
      initialised.current = true;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [carId, language, recordId]);

  const partsById = useMemo(() => {
    const map = new Map<string, Part>();
    for (const part of parts) map.set(part.id, part);
    return map;
  }, [parts]);

  const partTitle = useCallback(
    (part: Part): string => part.name ?? (part.catalogKey ? t(`catalog.${part.catalogKey}`) : ''),
    [t],
  );

  const partTitleById = useCallback(
    (partId: string): string => {
      const part = partsById.get(partId);
      return part ? partTitle(part) : t('common.dash');
    },
    [partsById, partTitle, t],
  );

  const kindOptions = useMemo<SegmentOption<ServiceKind>[]>(
    () => [
      { value: 'scheduled', label: t('records.scheduled') },
      { value: 'unscheduled', label: t('records.unscheduled') },
    ],
    [t],
  );

  /* ── Позиции ──────────────────────────────────────────────────────────── */

  const dropWarning = useCallback(() => setZeroPriced([]), []);

  const removePart = useCallback(
    (index: number) => {
      dropWarning();
      setPartEntries((current) => current.filter((_, i) => i !== index));
    },
    [dropWarning],
  );

  const removeService = useCallback(
    (index: number) => {
      dropWarning();
      setServiceEntries((current) => current.filter((_, i) => i !== index));
    },
    [dropWarning],
  );

  const openPartsSheet = useCallback(() => {
    setPartsQuery('');
    setPartsDraft(partEntries.map((entry) => entry.partId));
    setPartsSheetOpen(true);
  }, [partEntries]);

  const togglePartDraft = useCallback((partId: string) => {
    setPartsDraft((current) =>
      current.includes(partId)
        ? current.filter((id) => id !== partId)
        : [...current, partId],
    );
  }, []);

  /**
   * Уже выбранные позиции сохраняют свои цены; деталь, снятую с отслеживания, шторка
   * не показывает, поэтому она остаётся в записи, а не пропадает при подтверждении.
   */
  const applyParts = useCallback(() => {
    dropWarning();
    setPartEntries((current) => {
      const kept = current.filter((entry) => partsDraft.includes(entry.partId));
      const keptIds = new Set(kept.map((entry) => entry.partId));
      const added: PartEntry[] = trackedParts
        .filter((part) => partsDraft.includes(part.id) && !keptIds.has(part.id))
        .map((part) => ({ partId: part.id, categoryKey: part.categoryKey, cost: null }));
      return [...kept, ...added];
    });
    setPartsSheetOpen(false);
  }, [dropWarning, partsDraft, trackedParts]);

  const openServiceSheet = useCallback(() => {
    setServiceName('');
    setServiceCategory('engine');
    setServiceCost('');
    setCategoryPickerOpen(false);
    setServiceSheetOpen(true);
  }, []);

  const applyService = useCallback(() => {
    const name = serviceName.trim();
    if (name.length === 0) return;
    dropWarning();
    setServiceEntries((current) => [
      ...current,
      {
        key: nextServiceKey(),
        name,
        categoryKey: serviceCategory,
        cost: parseNumberInput(serviceCost),
      },
    ]);
    setServiceSheetOpen(false);
  }, [dropWarning, serviceCategory, serviceCost, serviceName]);

  const pickSuggestion = useCallback((key: string, label: string) => {
    setServiceName(label);
    const category = COMMON_SERVICE_CATEGORY[key];
    if (category) setServiceCategory(category);
  }, []);

  const openCostSheet = useCallback(
    (target: CostTarget) => {
      const cost =
        target.type === 'part'
          ? (partEntries[target.index]?.cost ?? null)
          : (serviceEntries[target.index]?.cost ?? null);
      setCostText(cost === null ? '' : formatNumber(cost, language));
      setCostTarget(target);
    },
    [language, partEntries, serviceEntries],
  );

  const applyCost = useCallback(() => {
    if (!costTarget) return;
    const cost = parseNumberInput(costText);
    dropWarning();
    if (costTarget.type === 'part') {
      setPartEntries((current) =>
        current.map((entry, i) => (i === costTarget.index ? { ...entry, cost } : entry)),
      );
    } else {
      setServiceEntries((current) =>
        current.map((entry, i) => (i === costTarget.index ? { ...entry, cost } : entry)),
      );
    }
    setCostTarget(null);
  }, [costTarget, costText, dropWarning]);

  /* ── Вычисление суммы ─────────────────────────────────────────────────── */

  /**
   * Позиции без цены считаются нулём, поэтому итог заведомо занижен — под полем
   * появляется предупреждение с их перечислением. Значение остаётся обычным
   * содержимым поля: пользователь волен его исправить, и сохранится именно оно.
   */
  const calculate = useCallback(() => {
    let sum = 0;
    const missing: string[] = [];
    for (const entry of partEntries) {
      if (entry.cost === null) missing.push(partTitleById(entry.partId));
      else sum += entry.cost;
    }
    for (const entry of serviceEntries) {
      if (entry.cost === null) missing.push(entry.name);
      else sum += entry.cost;
    }
    setTotalText(formatNumber(sum, language));
    setZeroPriced(missing);
  }, [language, partEntries, partTitleById, serviceEntries]);

  /* ── Сохранение ───────────────────────────────────────────────────────── */

  const save = useCallback(() => {
    if (!carId || !loaded) return;
    const date = parseDateInput(dateText);
    const mileage = parseNumberInput(mileageText);
    // Пока дата не разобрана, сверять линейность пробега не с чем — не шумим лишними ошибками.
    setDateInvalid(date === null);
    if (date === null) {
      setErrors([]);
      return;
    }
    const found = validateServiceRecord(
      { id: recordId, date, mileage: mileage ?? Number.NaN },
      existingRecords,
      todayIso(),
    );
    setErrors(found);
    if (found.length > 0 || mileage === null) return;

    const items: NewServiceItem[] = [
      ...partEntries.map<NewServiceItem>((entry) => ({
        type: 'part',
        partId: entry.partId,
        name: null,
        categoryKey: entry.categoryKey,
        cost: entry.cost,
      })),
      ...serviceEntries.map<NewServiceItem>((entry) => ({
        type: 'service',
        partId: null,
        name: entry.name,
        categoryKey: entry.categoryKey,
        cost: entry.cost,
      })),
    ];

    void (async () => {
      await saveRecord(
        {
          carId,
          date,
          mileage,
          kind,
          totalCost: parseNumberInput(totalText),
          items,
        },
        recordId,
      );
      refresh();
      navigation.goBack();
    })();
  }, [
    carId,
    dateText,
    existingRecords,
    kind,
    loaded,
    mileageText,
    navigation,
    partEntries,
    recordId,
    refresh,
    serviceEntries,
    totalText,
  ]);

  /* ── Производные значения для разметки ────────────────────────────────── */

  const filteredParts = useMemo(() => {
    const query = partsQuery.trim().toLowerCase();
    if (query.length === 0) return trackedParts;
    return trackedParts.filter((part) => partTitle(part).toLowerCase().includes(query));
  }, [partTitle, partsQuery, trackedParts]);

  const suggestions = useMemo(() => {
    const common = COMMON_SERVICES.map((key) => ({ key, label: t(`service.${key}`) }));
    const seen = new Set(common.map((item) => item.label.toLowerCase()));
    const known = knownServices
      .filter((name) => !seen.has(name.toLowerCase()))
      .map((name) => ({ key: name, label: name }));
    return [...common, ...known];
  }, [knownServices, t]);

  const errorMessages = useMemo(() => {
    const messages = errors.map((error) =>
      t(`validation.${error.code}`, {
        date: error.conflictsWith ? formatShortDate(error.conflictsWith.date, language) : '',
        mileage: error.conflictsWith ? formatNumber(error.conflictsWith.mileage, language) : '',
      }),
    );
    if (dateInvalid) messages.unshift(t('validation.date-invalid'));
    return messages;
  }, [dateInvalid, errors, language, t]);

  const content = (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: sizes.screenPadding + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.fieldsRow}>
        <Field
          label={t('recordForm.date')}
          value={dateText}
          onChangeText={(value) => {
            setDateInvalid(false);
            setDateText(maskDate(value));
          }}
          keyboardType="number-pad"
          placeholder={formatShortDate(todayIso(), language)}
          mono
          style={styles.flexField}
        />
        <Field
          label={t('recordForm.mileage')}
          value={mileageText}
          onChangeText={(value) => {
            const parsed = parseNumberInput(value);
            setMileageText(parsed === null ? '' : formatNumber(parsed, language));
          }}
          keyboardType="number-pad"
          suffix={t('units.km')}
          placeholder={activeCar ? formatNumber(activeCar.mileage, language) : ''}
          mono
          style={styles.flexField}
        />
      </View>

      {errorMessages.map((message, index) => (
        <Banner key={`${index}-${message}`} tone="warning" text={message} />
      ))}

      <View style={styles.section}>
        <SectionHeader title={t('recordForm.kind')} />
        <SegmentedControl options={kindOptions} value={kind} onChange={setKind} />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('recordForm.parts')} />
        {partEntries.length === 0 ? (
          <AppText variant="caption" tone="tertiary">
            {t('recordForm.noParts')}
          </AppText>
        ) : null}
        {partEntries.map((entry, index) => (
          <ItemRow
            key={`${entry.partId}-${index}`}
            name={partTitleById(entry.partId)}
            category={t(`category.${entry.categoryKey}`)}
            price={entry.cost === null ? t('common.dash') : formatNumber(entry.cost, language)}
            hasPrice={entry.cost !== null}
            onPress={() => openCostSheet({ type: 'part', index })}
            onRemove={() => removePart(index)}
            removeLabel={t('common.delete')}
          />
        ))}
        <OutlineButton
          title={t('recordForm.addPart')}
          icon={Plus}
          fullWidth
          onPress={openPartsSheet}
          style={styles.addButton}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('recordForm.services')} />
        {serviceEntries.length === 0 ? (
          <AppText variant="caption" tone="tertiary">
            {t('recordForm.noServices')}
          </AppText>
        ) : null}
        {serviceEntries.map((entry, index) => (
          <ItemRow
            key={entry.key}
            name={entry.name}
            category={t(`category.${entry.categoryKey}`)}
            price={entry.cost === null ? t('common.dash') : formatNumber(entry.cost, language)}
            hasPrice={entry.cost !== null}
            onPress={() => openCostSheet({ type: 'service', index })}
            onRemove={() => removeService(index)}
            removeLabel={t('common.delete')}
          />
        ))}
        <OutlineButton
          title={t('recordForm.addService')}
          icon={Plus}
          fullWidth
          onPress={openServiceSheet}
          style={styles.addButton}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('recordForm.cost')} />
        <View style={styles.amountRow}>
          <AmountField
            value={totalText}
            onChangeText={(value) => {
              const parsed = parseNumberInput(value);
              setTotalText(parsed === null ? '' : formatNumber(parsed, language));
            }}
            caption={t('recordForm.total')}
            placeholder={t('common.dash')}
          />
          <CalcButton label={t('common.calculate')} onPress={calculate} />
        </View>
        {zeroPriced.length > 0 ? (
          <Banner
            tone="warning"
            text={t('recordForm.noPriceWarning', {
              count: zeroPriced.length,
              list: zeroPriced.join('», «'),
            })}
          />
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar
        title={recordId ? t('recordForm.editTitle') : t('recordForm.title')}
        onBack={navigation.goBack}
        right={<TextAction label={t('common.save')} onPress={save} />}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>

      {/* Шторка выбора детали */}
      <BottomSheet
        visible={partsSheetOpen}
        onClose={() => setPartsSheetOpen(false)}
        title={t('recordForm.pickParts')}
        headerRight={<TextAction label={t('common.done')} onPress={applyParts} />}
        footer={
          <PrimaryButton
            fullWidth
            title={t('recordForm.addSelected', { count: partsDraft.length })}
            onPress={applyParts}
          />
        }
      >
        <View style={styles.sheetPadded}>
          <SearchInput
            value={partsQuery}
            onChangeText={setPartsQuery}
            placeholder={t('recordForm.searchCatalog')}
          />
        </View>
        <ScrollView
          style={styles.sheetList}
          contentContainerStyle={styles.sheetListContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredParts.length === 0 ? (
            <AppText variant="caption" tone="tertiary">
              {t('common.nothingFound')}
            </AppText>
          ) : null}
          {filteredParts.map((part, index) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: partsDraft.includes(part.id) }}
              key={part.id}
              onPress={() => togglePartDraft(part.id)}
              style={({ pressed }) => [
                styles.pickRow,
                index < filteredParts.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: sizes.border,
                },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Checkbox checked={partsDraft.includes(part.id)} />
              <View style={styles.pickText}>
                <AppText variant="bodyMedium">{partTitle(part)}</AppText>
                <AppText tone="tertiary" style={styles.itemCategory}>
                  {t(`category.${part.categoryKey}`)}
                </AppText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Шторка новой услуги: выбор категории показывается вместо тела, а не поверх него */}
      <BottomSheet
        visible={serviceSheetOpen}
        onClose={() => setServiceSheetOpen(false)}
        title={categoryPickerOpen ? t('recordForm.serviceCategory') : t('recordForm.addService')}
        footer={
          categoryPickerOpen ? undefined : (
            <PrimaryButton
              fullWidth
              title={t('recordForm.addService')}
              disabled={serviceName.trim().length === 0}
              onPress={applyService}
            />
          )
        }
      >
        {categoryPickerOpen ? (
          <ScrollView
            style={styles.sheetList}
            contentContainerStyle={styles.sheetListContent}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORY_KEYS.map((key, index) => (
              <Pressable
                accessibilityRole="button"
                key={key}
                onPress={() => {
                  setServiceCategory(key);
                  setCategoryPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.pickRow,
                  index < CATEGORY_KEYS.length - 1 && {
                    borderBottomColor: colors.border,
                    borderBottomWidth: sizes.border,
                  },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={styles.pickText}>
                  <AppText variant="bodyMedium">{t(`category.${key}`)}</AppText>
                </View>
                {key === serviceCategory ? (
                  <Check size={sizes.iconMd} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.sheetList}
            contentContainerStyle={styles.sheetBody}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label={t('recordForm.serviceName')}
              value={serviceName}
              onChangeText={setServiceName}
              placeholder={t('recordForm.serviceNamePlaceholder')}
            />
            <View style={styles.hintGroup}>
              <SelectField
                label={t('recordForm.serviceCategory')}
                value={t(`category.${serviceCategory}`)}
                onPress={() => setCategoryPickerOpen(true)}
              />
              <AppText variant="label" tone="tertiary" style={styles.hint}>
                {t('recordForm.categoryHint')}
              </AppText>
            </View>
            <View style={styles.section}>
              <SectionHeader title={t('recordForm.commonServices')} />
              <View style={styles.chipWrap}>
                {suggestions.map((item) => (
                  <Chip
                    key={item.key}
                    label={item.label}
                    onPress={() => pickSuggestion(item.key, item.label)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.hintGroup}>
              <Field
                label={t('recordForm.itemCost')}
                value={serviceCost}
                onChangeText={(value) => {
                  const parsed = parseNumberInput(value);
                  setServiceCost(parsed === null ? '' : formatNumber(parsed, language));
                }}
                keyboardType="number-pad"
                placeholder={t('common.dash')}
                mono
              />
              <AppText variant="label" tone="tertiary">
                {t('common.optional')}
              </AppText>
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Шторка цены позиции */}
      <BottomSheet
        visible={costTarget !== null}
        onClose={() => setCostTarget(null)}
        title={t('recordForm.editItemCost')}
        footer={<PrimaryButton fullWidth title={t('common.done')} onPress={applyCost} />}
      >
        <View style={[styles.sheetPadded, styles.hintGroup]}>
          <Field
            label={t('recordForm.itemCost')}
            value={costText}
            onChangeText={(value) => {
              const parsed = parseNumberInput(value);
              setCostText(parsed === null ? '' : formatNumber(parsed, language));
            }}
            keyboardType="number-pad"
            placeholder={t('common.dash')}
            mono
          />
          <AppText variant="label" tone="tertiary">
            {t('common.optional')}
          </AppText>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: spacing.md + 2,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  fieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  flexField: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  textAction: {
    alignItems: 'center',
    height: sizes.iconButton,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  textActionLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
  },
  itemRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14.5,
  },
  itemCategory: {
    fontSize: 11.5,
  },
  itemRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  addButton: {
    borderRadius: radius.md,
    height: 46,
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  amountField: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: sizes.border,
    flex: 1,
    flexDirection: 'row',
    height: sizes.buttonHeight,
    justifyContent: 'space-between',
    paddingHorizontal: layout.field.paddingHorizontal,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.monoBold,
    fontSize: 20,
    padding: 0,
  },
  amountCaption: {
    fontSize: fontSize.fieldLabel,
  },
  calcButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 7,
    height: sizes.buttonHeight,
    justifyContent: 'center',
    paddingHorizontal: layout.button.paddingHorizontal,
  },
  calcLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: fontSize.segment,
  },
  sheetPadded: {
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  sheetList: {
    flexGrow: 0,
    maxHeight: 340,
  },
  sheetListContent: {
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingTop: spacing.md,
  },
  sheetBody: {
    gap: spacing.md + 2,
    paddingHorizontal: layout.sheet.paddingHorizontal,
    paddingVertical: spacing.xs,
  },
  pickRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pickText: {
    flex: 1,
    gap: 2,
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 6,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  chipLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
  },
  search: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 9,
    height: 44,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 15,
    padding: 0,
  },
  hintGroup: {
    gap: spacing.s,
  },
  hint: {
    fontSize: 11.5,
    lineHeight: 11.5 * lineHeight.relaxed,
  },
});
