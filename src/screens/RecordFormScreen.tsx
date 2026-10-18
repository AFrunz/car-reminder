import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { parseISO } from 'date-fns';
import { Calculator, Calendar, Check, Plus, Search, X } from 'lucide-react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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
import {
  formatDecimal,
  formatNumber,
  formatShortDate,
  localIsoDate,
  maskShortDate,
  parseDecimalInput,
  parseNumberInput,
  parseShortDate,
} from '../lib/format';
import { describeResource } from '../lib/resourceText';
import {
  CATEGORY_KEYS,
  type CategoryKey,
  type ItemAction,
  type Part,
  type ServiceKind,
  type ServiceRecord,
} from '../domain/types';
import {
  effectiveMileage,
  validateServiceRecord,
  type ValidationError,
} from '../domain/validation';
import {
  baselineForCar,
  byUrgency,
  resourceForPart,
  summarizePartEvents,
  type Resource,
} from '../domain/resource';
import {
  getRecord,
  knownServiceNames,
  listParts,
  listRecords,
  partEventsForCar,
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
  /** Свободная пометка к позиции: модель, артикул, уточнение. Пусто — null. */
  note: string | null;
  /** Деталь заменили или только проверили. */
  action: ItemAction;
  /** Замер остатка при проверке, мм. */
  measurement: number | null;
}

/** Проверять есть смысл, когда у детали есть срок осмотра или её износ меряют. */
const canInspect = (part: Part | undefined): boolean =>
  part !== undefined &&
  (part.inspectKm != null ||
    part.inspectMonths != null ||
    (part.wearNew != null && part.wearMin != null));

const hasWearSpec = (part: Part | undefined): boolean =>
  part !== undefined && part.wearNew != null && part.wearMin != null;

/**
 * Что делаем с деталью по умолчанию. Деталь, у которой срока замены нет, а есть только
 * осмотр, в ТО почти всегда проверяют; всё остальное — меняют.
 */
const defaultAction = (part: Part): ItemAction =>
  part.intervalKm == null && part.intervalMonths == null && canInspect(part)
    ? 'inspect'
    : 'replace';

interface ServiceEntry {
  /** Локальный ключ строки — у услуги нет идентификатора до сохранения. */
  key: string;
  name: string;
  categoryKey: CategoryKey;
  cost: number | null;
  /** Свободная пометка к позиции: модель, артикул, уточнение. Пусто — null. */
  note: string | null;
}

/** Какая позиция сейчас редактируется в шторке цены и комментария. */
type CostTarget = { type: 'part'; index: number } | { type: 'service'; index: number };

let serviceKeySeed = 0;
const nextServiceKey = (): string => {
  serviceKeySeed += 1;
  return `service-${serviceKeySeed}`;
};

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

interface DateFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onOpenCalendar: () => void;
  calendarLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Дату можно набрать цифрами — маска сама расставит точки, — а можно выбрать в
 * календаре по кнопке справа. Набирать быстрее, когда ТО вносится задним числом пачкой,
 * календарь удобнее, когда дата недавняя.
 */
function DateField({
  label,
  value,
  onChangeText,
  placeholder,
  onOpenCalendar,
  calendarLabel,
  style,
}: DateFieldProps) {
  const colors = useColors();
  return (
    <View style={[styles.dateField, style]}>
      <AppText variant="label" tone="secondary" style={styles.dateLabel}>
        {label}
      </AppText>
      <View
        style={[styles.dateBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(maskShortDate(text))}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={DATE_LENGTH}
          style={[styles.dateInput, { color: colors.textPrimary }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={calendarLabel}
          hitSlop={10}
          onPress={onOpenCalendar}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Calendar size={sizes.iconMd} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

/** «дд.мм.гггг» — ровно десять знаков вместе с точками. */
const DATE_LENGTH = 10;

interface ItemRowProps {
  name: string;
  /** Пометка «проверка» — видна сразу, чтобы осмотр не приняли за замену. */
  tag?: string | null;
  category: string;
  /** Комментарий позиции; null — строку не показываем. */
  note: string | null;
  price: string;
  hasPrice: boolean;
  onPress: () => void;
  onRemove: () => void;
  removeLabel: string;
}

/**
 * Комментарий идёт отдельной строкой под названием, категория остаётся ниже: так длинная
 * пометка переносится по словам и не выдавливает категорию, нужную для разбивки расходов.
 */
function ItemRow({
  name,
  tag,
  category,
  note,
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
        {/* Пустая пометка из старых записей тоже не должна занимать строку */}
        {note !== null && note.length > 0 ? (
          <AppText tone="secondary" style={styles.itemNote} numberOfLines={2}>
            {note}
          </AppText>
        ) : null}
        <AppText tone="tertiary" style={styles.itemCategory}>
          {tag ? (
            <AppText tone="inspect" style={styles.itemCategory}>
              {`${tag} · `}
            </AppText>
          ) : null}
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

/**
 * Подпись детали в шторке выбора: категория и, если детали что-то нужно, — что именно.
 * Объясняет, почему просроченное оказалось наверху списка.
 */
function PickSubtitle({ category, resource }: { category: string; resource?: Resource }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const needs =
    resource &&
    (resource.status === 'overdue' || resource.status === 'inspect' || resource.status === 'warn')
      ? describeResource(resource, language, t)
      : null;
  return (
    <AppText tone="tertiary" style={styles.itemCategory}>
      {category}
      {needs ? (
        <AppText tone={needs.tone} style={styles.itemCategory}>
          {` · ${needs.text}`}
        </AppText>
      ) : null}
    </AppText>
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
  const inspectPartId = route.params?.inspectPartId;
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
  /** Ресурс каждой детали — по нему шторка ставит наверх то, что пора менять. */
  const [resources, setResources] = useState<Map<string, Resource>>(new Map());
  const [loaded, setLoaded] = useState(false);

  /* Поля записи */
  // Дата держится текстом: её можно набрать руками, и недонабранная — тоже состояние.
  const [dateText, setDateText] = useState<string>(() => formatShortDate(todayIso(), language));
  const [dateInvalid, setDateInvalid] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [mileageText, setMileageText] = useState('');
  const [kind, setKind] = useState<ServiceKind>('scheduled');
  const [partEntries, setPartEntries] = useState<PartEntry[]>([]);
  const [serviceEntries, setServiceEntries] = useState<ServiceEntry[]>([]);
  const [totalText, setTotalText] = useState('');
  /**
   * Сумму вписали руками — автосчёт выключен и значение принадлежит пользователю.
   * У существующей записи сумма уже сохранена им, поэтому там признак истинен сразу.
   */
  const [totalEdited, setTotalEdited] = useState(false);

  /* Ошибки и предупреждения */
  const [errors, setErrors] = useState<ValidationError[]>([]);
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

  /* Шторка цены и комментария позиции */
  const [costTarget, setCostTarget] = useState<CostTarget | null>(null);
  const [costText, setCostText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [actionDraft, setActionDraft] = useState<ItemAction>('replace');
  const [measurementText, setMeasurementText] = useState('');

  /** Поля заполняются из записи ровно один раз — иначе перезагрузка затрёт правки. */
  const initialised = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!carId) {
      setLoaded(true);
      return;
    }
    void (async () => {
      const [allParts, tracked, records, names, events] = await Promise.all([
        listParts(carId),
        listParts(carId, true),
        listRecords(carId),
        knownServiceNames(carId),
        partEventsForCar(carId),
      ]);
      const record = recordId ? await getRecord(recordId) : null;
      if (cancelled) return;
      setParts(allParts);
      setTrackedParts(tracked);
      setExistingRecords(records);
      setKnownServices(names);
      if (activeCar) {
        const histories = summarizePartEvents(events);
        const mileage = effectiveMileage(activeCar.mileage, records);
        const today = todayIso();
        const baseline = baselineForCar(activeCar);
        setResources(
          new Map(
            tracked.map((part) => [
              part.id,
              resourceForPart(part, histories[part.id], mileage, today, baseline),
            ]),
          ),
        );
      }
      if (!record && inspectPartId && !initialised.current) {
        // Проверка из карточки детали: внеплановая запись с одной этой позицией.
        const part = allParts.find((candidate) => candidate.id === inspectPartId);
        if (part) {
          setKind('unscheduled');
          setPartEntries([
            {
              partId: part.id,
              categoryKey: part.categoryKey,
              cost: null,
              note: null,
              action: 'inspect',
              measurement: null,
            },
          ]);
        }
      }
      if (record && !initialised.current) {
        setDateText(formatShortDate(record.date, language));
        setMileageText(formatNumber(record.mileage, language));
        setKind(record.kind);
        setTotalText(record.totalCost === null ? '' : formatNumber(record.totalCost, language));
        setTotalEdited(true);
        const restoredParts: PartEntry[] = [];
        for (const item of record.items) {
          if (item.type !== 'part' || item.partId === null) continue;
          restoredParts.push({
            partId: item.partId,
            categoryKey: item.categoryKey,
            cost: item.cost,
            note: item.note,
            action: item.action,
            measurement: item.measurement,
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
              note: item.note,
            })),
        );
      }
      initialised.current = true;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // activeCar нужен ради пробега и года — пересчитывать ресурс при их смене правильно.
  }, [activeCar, carId, inspectPartId, language, recordId]);

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

  /* ── Дата ─────────────────────────────────────────────────────────────── */

  /** Задним числом запись завести можно, будущим — нет (SPEC.md). */
  const maxDate = useMemo(() => parseISO(todayIso()), []);

  /** null — дата набрана не полностью или такого дня нет. */
  const dateIso = parseShortDate(dateText);

  const onDateText = useCallback((value: string) => {
    setDateText(value);
    setDateInvalid(false);
  }, []);

  const onDateChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // Android показывает календарь отдельным диалогом: после любого ответа он закрыт.
      setDatePickerOpen(false);
      if (event.type === 'dismissed' || !selected) return;
      setDateText(formatShortDate(localIsoDate(selected), language));
      setDateInvalid(false);
    },
    [language],
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
        .map((part) => ({
          partId: part.id,
          categoryKey: part.categoryKey,
          cost: null,
          note: null,
          action: defaultAction(part),
          measurement: null,
        }));
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
        note: null,
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
      const entry =
        target.type === 'part' ? partEntries[target.index] : serviceEntries[target.index];
      const cost = entry?.cost ?? null;
      setCostText(cost === null ? '' : formatNumber(cost, language));
      setNoteText(entry?.note ?? '');
      const partEntry = target.type === 'part' ? partEntries[target.index] : undefined;
      setActionDraft(partEntry?.action ?? 'replace');
      setMeasurementText(
        partEntry?.measurement == null ? '' : formatDecimal(partEntry.measurement, language),
      );
      setCostTarget(target);
    },
    [language, partEntries, serviceEntries],
  );

  /** Комментарий необязателен: пустая строка (и одни пробелы) сохраняется как null. */
  const applyCost = useCallback(() => {
    if (!costTarget) return;
    const cost = parseNumberInput(costText);
    const trimmed = noteText.trim();
    const note = trimmed.length === 0 ? null : trimmed;
    dropWarning();
    if (costTarget.type === 'part') {
      // Замер принадлежит проверке: у замены толщина новой детали и так известна.
      const action = actionDraft;
      const measurement = action === 'inspect' ? parseDecimalInput(measurementText) : null;
      setPartEntries((current) =>
        current.map((entry, i) =>
          i === costTarget.index ? { ...entry, cost, note, action, measurement } : entry,
        ),
      );
    } else {
      setServiceEntries((current) =>
        current.map((entry, i) => (i === costTarget.index ? { ...entry, cost, note } : entry)),
      );
    }
    setCostTarget(null);
  }, [actionDraft, costTarget, costText, dropWarning, measurementText, noteText]);

  /* ── Вычисление суммы ─────────────────────────────────────────────────── */

  /**
   * Сумма позиций и названия тех, у кого цены нет: позиции без цены считаются нулём,
   * поэтому итог заведомо занижен — под полем появляется предупреждение с их перечислением.
   * `hasPriced` отделяет настоящий ноль от «цену вообще не указывали»: пока ни одной цены
   * нет, считать нечего и подставлять в поле нечего.
   */
  const itemsTotal = useMemo(() => {
    let sum = 0;
    let priced = 0;
    const missing: string[] = [];
    for (const entry of partEntries) {
      if (entry.cost === null) missing.push(partTitleById(entry.partId));
      else {
        sum += entry.cost;
        priced += 1;
      }
    }
    for (const entry of serviceEntries) {
      if (entry.cost === null) missing.push(entry.name);
      else {
        sum += entry.cost;
        priced += 1;
      }
    }
    return { sum, missing, hasPriced: priced > 0 };
  }, [partEntries, partTitleById, serviceEntries]);

  /** Подставить сумму позиций в поле. Значение остаётся обычным содержимым поля. */
  const syncTotal = useCallback(() => {
    setTotalText(itemsTotal.hasPriced ? formatNumber(itemsTotal.sum, language) : '');
    setZeroPriced(itemsTotal.hasPriced ? itemsTotal.missing : []);
  }, [itemsTotal, language]);

  /** Пока сумму не трогали руками, поле идёт за позициями — как «Вычислить» после каждой правки. */
  useEffect(() => {
    if (totalEdited) return;
    syncTotal();
  }, [syncTotal, totalEdited]);

  /** Кнопка нужна после ручной правки: считает и снова отдаёт поле автосчёту. */
  const calculate = useCallback(() => {
    syncTotal();
    setTotalEdited(false);
  }, [syncTotal]);

  /* ── Сохранение ───────────────────────────────────────────────────────── */

  const save = useCallback(() => {
    if (!carId || !loaded) return;
    const mileage = parseNumberInput(mileageText);
    setDateInvalid(dateIso === null);
    const found = validateServiceRecord(
      // Недонабранная дата отдельной ошибкой: проверять линейность пробега ей не с чем.
      { id: recordId, date: dateIso ?? '0000-00-00', mileage: mileage ?? Number.NaN },
      existingRecords,
      todayIso(),
    ).filter((error) => dateIso !== null || error.code === 'mileage-not-positive');
    setErrors(found);
    if (found.length > 0 || mileage === null || dateIso === null) return;

    const items: NewServiceItem[] = [
      ...partEntries.map<NewServiceItem>((entry) => ({
        type: 'part',
        partId: entry.partId,
        name: null,
        categoryKey: entry.categoryKey,
        cost: entry.cost,
        note: entry.note,
        action: entry.action,
        measurement: entry.action === 'inspect' ? entry.measurement : null,
      })),
      ...serviceEntries.map<NewServiceItem>((entry) => ({
        type: 'service',
        partId: null,
        name: entry.name,
        categoryKey: entry.categoryKey,
        cost: entry.cost,
        note: entry.note,
        action: 'replace',
        measurement: null,
      })),
    ];

    // Поле пустое — уходит сумма позиций; но если ни одной цены нет, это не нулевой чек, а null.
    const typedTotal = parseNumberInput(totalText);
    const totalCost = typedTotal ?? (itemsTotal.hasPriced ? itemsTotal.sum : null);

    void (async () => {
      await saveRecord(
        {
          carId,
          date: dateIso,
          mileage,
          kind,
          totalCost,
          items,
        },
        recordId,
      );
      refresh();
      navigation.goBack();
    })();
  }, [
    carId,
    dateIso,
    existingRecords,
    itemsTotal,
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

  const costTargetPart =
    costTarget?.type === 'part'
      ? partsById.get(partEntries[costTarget.index]?.partId ?? '')
      : undefined;

  const actionOptions = useMemo<SegmentOption<ItemAction>[]>(
    () => [
      { value: 'replace', label: t('recordForm.actionReplace') },
      { value: 'inspect', label: t('recordForm.actionInspect') },
    ],
    [t],
  );

  /**
   * Наверху шторки — то, что пора менять или проверять: в ТО чаще всего добавляют именно
   * это, и листать полсотни позиций ради просроченного масла незачем. Деталь, у которой
   * ресурс не посчитан, остаётся в каталожном порядке в самом конце.
   */
  const filteredParts = useMemo(() => {
    const query = partsQuery.trim().toLowerCase();
    const visible =
      query.length === 0
        ? trackedParts
        : trackedParts.filter((part) => partTitle(part).toLowerCase().includes(query));
    return [...visible].sort((a, b) => {
      const ra = resources.get(a.id);
      const rb = resources.get(b.id);
      if (!ra || !rb) return (ra ? 0 : 1) - (rb ? 0 : 1);
      return byUrgency(ra, rb);
    });
  }, [partTitle, partsQuery, resources, trackedParts]);

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
    return messages;
  }, [errors, language, t]);

  /**
   * Обёртка над содержимым снимает фокус тапом по пустому месту: `handled` пропускает
   * нажатия по полям, кнопкам и строкам позиций к ним самим, а всё остальное доходит
   * до обёртки и убирает клавиатуру. `flexGrow` растягивает её на весь экран, чтобы
   * пустота под последней секцией тоже была кликабельной.
   */
  const content = (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={[styles.content, { paddingBottom: sizes.screenPadding + insets.bottom }]}
      >
        <View style={styles.fieldsRow}>
          <DateField
            label={t('recordForm.date')}
            value={dateText}
            onChangeText={onDateText}
            placeholder={t('recordForm.datePlaceholder')}
            onOpenCalendar={() => setDatePickerOpen(true)}
            calendarLabel={t('recordForm.openCalendar')}
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

        {dateInvalid ? <Banner tone="warning" text={t('validation.date-invalid')} /> : null}
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
              tag={
                entry.action === 'inspect'
                  ? entry.measurement != null
                    ? t('records.inspectedMeasured', {
                        mm: formatDecimal(entry.measurement, language),
                      })
                    : t('records.inspected')
                  : null
              }
              category={t(`category.${entry.categoryKey}`)}
              note={entry.note}
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
              note={entry.note}
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
                // Любой ввод, включая стирание, отдаёт поле пользователю и гасит автосчёт.
                setTotalEdited(true);
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
      </Pressable>
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

      {/* Системный календарь: на Android это отдельный диалог, живёт только пока открыт */}
      {datePickerOpen ? (
        <DateTimePicker
          value={parseISO(dateIso ?? todayIso())}
          mode="date"
          display="calendar"
          maximumDate={maxDate}
          onChange={onDateChange}
        />
      ) : null}

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
        {/* Прокрутку и подъём над клавиатурой обеспечивает сама шторка */}
        <View style={styles.sheetListContent}>
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
                <PickSubtitle
                  category={t(`category.${part.categoryKey}`)}
                  resource={resources.get(part.id)}
                />
              </View>
            </Pressable>
          ))}
        </View>
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
          <View style={styles.sheetListContent}>
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
          </View>
        ) : (
          <View style={styles.sheetBody}>
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
          </View>
        )}
      </BottomSheet>

      {/* Шторка цены и комментария позиции */}
      <BottomSheet
        visible={costTarget !== null}
        onClose={() => setCostTarget(null)}
        title={
          costTarget?.type === 'part'
            ? partTitleById(partEntries[costTarget.index]?.partId ?? '')
            : t('recordForm.editItemCost')
        }
        footer={<PrimaryButton fullWidth title={t('common.done')} onPress={applyCost} />}
      >
        <View style={[styles.sheetPadded, styles.sheetFields]}>
          {costTargetPart && canInspect(costTargetPart) ? (
            <SegmentedControl
              options={actionOptions}
              value={actionDraft}
              onChange={setActionDraft}
            />
          ) : null}
          {costTargetPart && hasWearSpec(costTargetPart) && actionDraft === 'inspect' ? (
            <View style={styles.hintGroup}>
              <Field
                label={t('recordForm.measurement')}
                value={measurementText}
                onChangeText={setMeasurementText}
                keyboardType="decimal-pad"
                suffix={t('units.mm')}
                placeholder={t('common.dash')}
                mono
              />
              <AppText variant="label" tone="tertiary" style={styles.hint}>
                {t('recordForm.measurementHint', {
                  from: formatDecimal(costTargetPart.wearNew as number, language),
                  to: formatDecimal(costTargetPart.wearMin as number, language),
                })}
              </AppText>
            </View>
          ) : null}
          <View style={styles.hintGroup}>
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
          <View style={styles.hintGroup}>
            <Field
              label={t('recordForm.itemNote')}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('recordForm.itemNotePlaceholder')}
            />
            <AppText variant="label" tone="tertiary">
              {t('common.optional')}
            </AppText>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
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
  dateField: {
    gap: layout.field.gap,
  },
  dateLabel: {
    fontFamily: fonts.uiMedium,
  },
  dateBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: sizes.border,
    flexDirection: 'row',
    gap: spacing.sm,
    height: sizes.fieldHeight,
    justifyContent: 'space-between',
    paddingHorizontal: layout.field.paddingHorizontal,
  },
  dateInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.fieldValue,
    padding: 0,
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
  /** Комментарий переносится по словам, лишнее уходит в многоточие в конце второй строки. */
  itemNote: {
    fontSize: 12.5,
    lineHeight: 12.5 * lineHeight.relaxed,
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
  sheetFields: {
    gap: spacing.md + 2,
  },
  hint: {
    fontSize: 11.5,
    lineHeight: 11.5 * lineHeight.relaxed,
  },
});
