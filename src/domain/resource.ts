import type { Car, ItemAction, Part } from './types';

/**
 * Остаточный ресурс детали.
 *
 * Шкала инвертирована: 100 — деталь только что заменили, 0 — пора менять.
 * Кольцо строится по пробегу, если у детали задан километровый интервал, иначе по
 * времени. Просрочка по времени не обнуляет кольцо, но красит его в красный: пользователь
 * должен видеть, сколько километров ещё есть, и одновременно понимать, что срок вышел.
 *
 * Если замен в истории нет, ресурс считается от начала жизни машины — исходим из того,
 * что деталь не меняли ни разу. Это честнее пустого кольца: не менявшийся сто тысяч
 * километров ремень ГРМ должен выглядеть просроченным, а не «неизвестным». Но допущение
 * это остаётся допущением, поэтому такой расчёт помечается флагом `assumed`, и интерфейс
 * обязан показать рядом оговорку «нет данных».
 *
 * Поверх замены есть ещё две вещи. Интервал проверки — отдельный счётчик, который ничего
 * не обнуляет, а только напоминает посмотреть; когда он вышел, деталь получает статус
 * `inspect`. И замер износа: если при проверке вписали толщину, ресурс считается по ней,
 * а километровый интервал уступает место настоящему измерению.
 */

export type ResourceStatus = 'ok' | 'warn' | 'inspect' | 'overdue' | 'no-data';

export interface InspectionState {
  /** Остаток до проверки; отрицательное значение — проверка просрочена. */
  kmLeft: number | null;
  monthsLeft: number | null;
  /** Пора проверить: вышел хотя бы один из сроков. */
  due: boolean;
  /** Ни проверок, ни замен не было — срок отсчитан от начала жизни машины. */
  assumed: boolean;
}

export interface WearState {
  /** Последний замер после последней замены, мм. */
  measured: number;
  mileage: number;
  date: string;
  /** Толщина на сегодня с поправкой на пробег после замера, мм. */
  estimated: number;
  /** Скорость износа известна, и `estimated` экстраполирован, а не равен замеру. */
  extrapolated: boolean;
}

export interface Resource {
  status: ResourceStatus;
  /** 0..100; null, только когда посчитать нечем — не задан ни один интервал. */
  value: number | null;
  /** Остаток пробега до замены; отрицательное значение — перепробег. null — не считается. */
  kmLeft: number | null;
  /** Остаток в целых месяцах до замены; отрицательное значение — просрочка. */
  monthsLeft: number | null;
  /**
   * Шкала, по которой построено кольцо: интервал замены по пробегу или времени, замер
   * износа или — у детали, которую только осматривают, — срок до проверки.
   */
  basis: 'km' | 'time' | 'wear' | 'inspection' | null;
  /** Замен в истории не было, ресурс посчитан от начала жизни машины. */
  assumed: boolean;
  /** Срок проверки; null — интервала проверки у детали нет. */
  inspection: InspectionState | null;
  /** Замер износа; null — не мерили или у детали не задан износ. */
  wear: WearState | null;
}

/** Ниже этого значения деталь попадает в блок «Требует внимания». */
export const WARN_THRESHOLD = 20;

const DAYS_PER_MONTH = 30.4375;

export interface LastChange {
  mileage: number;
  /** ISO-дата yyyy-mm-dd. */
  date: string;
}

export interface Measurement extends LastChange {
  /** Замеренный остаток, мм. */
  value: number;
}

/** Считать нечем: у детали не задан ни один интервал, значит нет ни шкалы, ни отсчёта. */
export const NO_DATA: Resource = {
  status: 'no-data',
  value: null,
  kmLeft: null,
  monthsLeft: null,
  basis: null,
  assumed: false,
  inspection: null,
  wear: null,
};

/**
 * Точка отсчёта для детали, которую никогда не меняли: нулевой пробег и первое января
 * года выпуска. Точная дата схода с конвейера неизвестна и в приложении не хранится,
 * а ошибка в пределах года на фоне интервалов в несколько лет несущественна.
 */
export function baselineForCar(car: Pick<Car, 'year'>): LastChange {
  return { mileage: 0, date: `${car.year}-01-01` };
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Пробег растёт вместе с датой, поэтому «позже» — по пробегу, а при равном — по дате. */
function isLater(a: LastChange, b: LastChange): boolean {
  return a.mileage > b.mileage || (a.mileage === b.mileage && a.date > b.date);
}

function latest(a: LastChange | null, b: LastChange | null): LastChange | null {
  if (a === null) return b;
  if (b === null) return a;
  return isLater(a, b) ? a : b;
}

interface Scale {
  kmLeft: number | null;
  monthsLeft: number | null;
  kmPercent: number | null;
  timePercent: number | null;
  /** Вышел хотя бы один из двух сроков. */
  expired: boolean;
  expiredByTime: boolean;
}

/** Остаток по паре «километры + месяцы» от точки отсчёта — общий для замены и проверки. */
function measureScale(
  intervalKm: number | null,
  intervalMonths: number | null,
  from: LastChange,
  currentMileage: number,
  today: string,
): Scale {
  const kmLeft = intervalKm != null ? intervalKm - (currentMileage - from.mileage) : null;
  const kmPercent = intervalKm != null && kmLeft != null ? (kmLeft / intervalKm) * 100 : null;

  let monthsLeft: number | null = null;
  let timePercent: number | null = null;
  if (intervalMonths != null) {
    const intervalDays = intervalMonths * DAYS_PER_MONTH;
    const daysLeft = intervalDays - daysBetween(from.date, today);
    monthsLeft = Math.floor(daysLeft / DAYS_PER_MONTH);
    timePercent = (daysLeft / intervalDays) * 100;
  }

  const expiredByKm = kmLeft != null && kmLeft <= 0;
  const expiredByTime = timePercent != null && timePercent <= 0;
  return {
    kmLeft,
    monthsLeft,
    kmPercent,
    timePercent,
    expired: expiredByKm || expiredByTime,
    expiredByTime,
  };
}

/** Кольцо по шкале: километры, если они заданы, иначе время. */
function scalePercent(scale: Scale): number {
  return clampPercent(scale.kmPercent ?? (scale.timePercent as number));
}

type ResourcePart = Pick<Part, 'intervalKm' | 'intervalMonths'> &
  Partial<Pick<Part, 'inspectKm' | 'inspectMonths' | 'wearNew' | 'wearMin'>>;

export interface ResourceExtras {
  /** Последняя проверка из записей ТО. */
  lastInspection?: LastChange | null;
  /** Последний замер; более ранний, чем последняя замена, игнорируется. */
  measurement?: Measurement | null;
}

/**
 * Замер износа: толщина на сегодня и сколько километров до предела. Скорость износа
 * берётся из пары «замена → замер», когда замена известна, иначе из километрового
 * интервала: он и задаёт, за сколько новая деталь стирается до предела. Без того и
 * другого экстраполировать не на что — тогда показываем замер как есть.
 */
function measureWear(
  part: ResourcePart,
  measurement: Measurement,
  lastChange: LastChange | null,
  currentMileage: number,
): { state: WearState; percent: number; kmLeft: number | null } {
  const wearNew = part.wearNew as number;
  const wearMin = part.wearMin as number;

  let rate: number | null = null;
  if (
    lastChange !== null &&
    measurement.mileage > lastChange.mileage &&
    measurement.value < wearNew
  ) {
    rate = (wearNew - measurement.value) / (measurement.mileage - lastChange.mileage);
  } else if (part.intervalKm != null && part.intervalKm > 0) {
    rate = (wearNew - wearMin) / part.intervalKm;
  }

  const driven = Math.max(0, currentMileage - measurement.mileage);
  const estimated = rate !== null ? measurement.value - rate * driven : measurement.value;
  const percent = ((estimated - wearMin) / (wearNew - wearMin)) * 100;
  const kmLeft = rate !== null && rate > 0 ? Math.round((estimated - wearMin) / rate) : null;

  return {
    state: {
      measured: measurement.value,
      mileage: measurement.mileage,
      date: measurement.date,
      estimated: Math.max(0, estimated),
      extrapolated: rate !== null && driven > 0,
    },
    percent,
    kmLeft,
  };
}

/**
 * @param part деталь с интервалами
 * @param lastChange последняя замена из записей ТО; null — замен не было
 * @param currentMileage текущий пробег машины
 * @param today ISO-дата «сегодня»; передаётся явно, чтобы расчёт был детерминированным
 * @param baseline точка отсчёта для детали без замен — см. `baselineForCar`
 * @param extras последняя проверка и замер — см. `summarizePartEvents`
 */
export function calculateResource(
  part: ResourcePart,
  lastChange: LastChange | null,
  currentMileage: number,
  today: string,
  baseline: LastChange,
  extras: ResourceExtras = {},
): Resource {
  const inspectKm = part.inspectKm ?? null;
  const inspectMonths = part.inspectMonths ?? null;
  const hasReplacement = part.intervalKm != null || part.intervalMonths != null;
  const hasInspection = inspectKm != null || inspectMonths != null;
  const hasWear =
    part.wearNew != null && part.wearMin != null && part.wearNew > part.wearMin;

  // Замер, сделанный до последней замены, описывает уже снятую деталь.
  const candidate = extras.measurement ?? null;
  const measurement =
    hasWear && candidate !== null && (lastChange === null || !isLater(lastChange, candidate))
      ? candidate
      : null;

  if (!hasReplacement && !hasInspection && measurement === null) return NO_DATA;

  const replacement = hasReplacement
    ? measureScale(
        part.intervalKm,
        part.intervalMonths,
        lastChange ?? baseline,
        currentMileage,
        today,
      )
    : null;

  let inspection: InspectionState | null = null;
  let inspectionPercent: number | null = null;
  if (hasInspection) {
    // Замена — тоже осмотр: новую деталь проверять незачем. И замер без осмотра не бывает.
    const anchor = latest(latest(extras.lastInspection ?? null, lastChange), measurement);
    const scale = measureScale(inspectKm, inspectMonths, anchor ?? baseline, currentMileage, today);
    inspection = {
      kmLeft: scale.kmLeft,
      monthsLeft: scale.monthsLeft,
      due: scale.expired,
      assumed: anchor === null,
    };
    inspectionPercent = scalePercent(scale);
  }

  const wear = measurement ? measureWear(part, measurement, lastChange, currentMileage) : null;

  let basis: Resource['basis'];
  let value: number;
  let kmLeft: number | null = null;
  let monthsLeft: number | null = null;
  let overdue: boolean;
  let assumed: boolean;

  if (wear) {
    // Замер сильнее интервала по пробегу: меряли настоящую деталь. Срок по времени
    // остаётся в силе — у шин, например, резина стареет независимо от протектора.
    basis = 'wear';
    value = clampPercent(wear.percent);
    kmLeft = wear.kmLeft;
    monthsLeft = replacement?.monthsLeft ?? null;
    overdue = wear.state.estimated <= (part.wearMin as number) || (replacement?.expiredByTime ?? false);
    assumed = false;
  } else if (replacement) {
    basis = replacement.kmPercent != null ? 'km' : 'time';
    value = scalePercent(replacement);
    kmLeft = replacement.kmLeft;
    monthsLeft = replacement.monthsLeft;
    overdue = replacement.expired;
    assumed = lastChange === null;
  } else {
    // Деталь только осматривают: кольцо показывает, сколько осталось до проверки.
    basis = 'inspection';
    value = inspectionPercent as number;
    overdue = false;
    assumed = (inspection as InspectionState).assumed;
  }

  // Порядок важен: просрочка замены — худшее, что может быть; срок проверки — повод
  // посмотреть, и он важнее, чем «скоро менять»: осмотр и покажет, пора ли.
  let status: ResourceStatus;
  if (overdue) status = 'overdue';
  else if (inspection?.due) status = 'inspect';
  else if (basis !== 'inspection' && value <= WARN_THRESHOLD) status = 'warn';
  else status = 'ok';

  return {
    status,
    value,
    kmLeft,
    monthsLeft,
    basis,
    assumed,
    inspection,
    wear: wear?.state ?? null,
  };
}

/** Одно действие с деталью из записи ТО. */
export interface PartEvent extends LastChange {
  partId: string;
  action: ItemAction;
  /** Замер при проверке, мм. */
  measurement: number | null;
}

export interface PartHistory {
  lastChange: LastChange | null;
  lastInspection: LastChange | null;
  /** Последний замер после последней замены. */
  measurement: Measurement | null;
}

export const EMPTY_HISTORY: PartHistory = {
  lastChange: null,
  lastInspection: null,
  measurement: null,
};

/** Сворачивает все действия с деталями в последнюю замену, проверку и замер по каждой. */
export function summarizePartEvents(events: PartEvent[]): Record<string, PartHistory> {
  const result: Record<string, PartHistory> = {};
  for (const event of events) {
    const point: LastChange = { mileage: event.mileage, date: event.date };
    const current = result[event.partId] ?? { ...EMPTY_HISTORY };
    if (event.action === 'replace') {
      current.lastChange = latest(current.lastChange, point);
    } else {
      current.lastInspection = latest(current.lastInspection, point);
      if (
        event.measurement !== null &&
        (current.measurement === null || isLater(point, current.measurement))
      ) {
        current.measurement = { ...point, value: event.measurement };
      }
    }
    result[event.partId] = current;
  }
  // Замер старше последней замены относится к снятой детали.
  for (const history of Object.values(result)) {
    if (
      history.measurement !== null &&
      history.lastChange !== null &&
      isLater(history.lastChange, history.measurement)
    ) {
      history.measurement = null;
    }
  }
  return result;
}

/** Ресурс детали по её свёрнутой истории — то, что нужно всем экранам. */
export function resourceForPart(
  part: ResourcePart,
  history: PartHistory | undefined,
  currentMileage: number,
  today: string,
  baseline: LastChange,
): Resource {
  const h = history ?? EMPTY_HISTORY;
  return calculateResource(part, h.lastChange, currentMileage, today, baseline, {
    lastInspection: h.lastInspection,
    measurement: h.measurement,
  });
}

/**
 * Порядок срочности: просрочка, затем пора проверить, затем скоро менять, затем всё
 * остальное по остатку. Детали, которые посчитать нечем, — в самом конце.
 */
const STATUS_RANK: Record<ResourceStatus, number> = {
  overdue: 0,
  inspect: 1,
  warn: 2,
  ok: 3,
  'no-data': 4,
};

export function byUrgency(a: Resource, b: Resource): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  return (a.value ?? 100) - (b.value ?? 100);
}

/** Прогресс до следующего регулярного ТО. Возвращает null, если регулярных ТО нет. */
export function calculateNextService(
  intervalKm: number,
  intervalMonths: number,
  lastScheduled: LastChange | null,
  currentMileage: number,
  today: string,
  baseline: LastChange,
): (Resource & { dueAtMileage: number | null }) | null {
  if (intervalKm <= 0 && intervalMonths <= 0) return null;
  const resource = calculateResource(
    {
      intervalKm: intervalKm > 0 ? intervalKm : null,
      intervalMonths: intervalMonths > 0 ? intervalMonths : null,
    },
    lastScheduled,
    currentMileage,
    today,
    baseline,
  );
  const from = lastScheduled ?? baseline;
  const dueAtMileage = intervalKm > 0 ? from.mileage + intervalKm : null;
  return { ...resource, dueAtMileage };
}
