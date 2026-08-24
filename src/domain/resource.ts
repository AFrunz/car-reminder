import type { Car, Part } from './types';

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
 */

export type ResourceStatus = 'ok' | 'warn' | 'overdue' | 'no-data';

export interface Resource {
  status: ResourceStatus;
  /** 0..100; null, только когда посчитать нечем — не задан ни один интервал. */
  value: number | null;
  /** Остаток пробега; отрицательное значение — перепробег. null, если интервал не задан. */
  kmLeft: number | null;
  /** Остаток в целых месяцах; отрицательное значение — просрочка. */
  monthsLeft: number | null;
  /** Шкала, по которой построено кольцо. */
  basis: 'km' | 'time' | null;
  /** Замен в истории не было, ресурс посчитан от начала жизни машины. */
  assumed: boolean;
}

/** Ниже этого значения деталь попадает в блок «Требует внимания». */
export const WARN_THRESHOLD = 20;

const DAYS_PER_MONTH = 30.4375;

export interface LastChange {
  mileage: number;
  /** ISO-дата yyyy-mm-dd. */
  date: string;
}

/** Считать нечем: у детали не задан ни один интервал, значит нет ни шкалы, ни отсчёта. */
export const NO_DATA: Resource = {
  status: 'no-data',
  value: null,
  kmLeft: null,
  monthsLeft: null,
  basis: null,
  assumed: false,
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

/**
 * @param part деталь с интервалами
 * @param lastChange последняя замена из записей ТО; null — замен не было
 * @param currentMileage текущий пробег машины
 * @param today ISO-дата «сегодня»; передаётся явно, чтобы расчёт был детерминированным
 * @param baseline точка отсчёта для детали без замен — см. `baselineForCar`
 */
export function calculateResource(
  part: Pick<Part, 'intervalKm' | 'intervalMonths'>,
  lastChange: LastChange | null,
  currentMileage: number,
  today: string,
  baseline: LastChange,
): Resource {
  const hasInterval = part.intervalKm != null || part.intervalMonths != null;
  if (!hasInterval) return NO_DATA;

  const assumed = lastChange === null;
  const from = lastChange ?? baseline;

  const kmLeft = part.intervalKm != null ? part.intervalKm - (currentMileage - from.mileage) : null;

  let monthsLeft: number | null = null;
  let timePercent: number | null = null;
  if (part.intervalMonths != null) {
    const intervalDays = part.intervalMonths * DAYS_PER_MONTH;
    const daysLeft = intervalDays - daysBetween(from.date, today);
    monthsLeft = Math.floor(daysLeft / DAYS_PER_MONTH);
    timePercent = (daysLeft / intervalDays) * 100;
  }

  const kmPercent =
    part.intervalKm != null && kmLeft != null ? (kmLeft / part.intervalKm) * 100 : null;

  const basis: 'km' | 'time' = kmPercent != null ? 'km' : 'time';
  const value = clampPercent(basis === 'km' ? (kmPercent as number) : (timePercent as number));

  const overdueByKm = kmLeft != null && kmLeft <= 0;
  const overdueByTime = monthsLeft != null && (timePercent as number) <= 0;

  let status: ResourceStatus;
  if (overdueByKm || overdueByTime) status = 'overdue';
  else if (value <= WARN_THRESHOLD) status = 'warn';
  else status = 'ok';

  return { status, value, kmLeft, monthsLeft, basis, assumed };
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
