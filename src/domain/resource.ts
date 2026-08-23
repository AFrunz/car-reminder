import type { Part } from './types';

/**
 * Остаточный ресурс детали.
 *
 * Шкала инвертирована: 100 — деталь только что заменили, 0 — пора менять.
 * Кольцо строится по пробегу, если у детали задан километровый интервал, иначе по
 * времени. Просрочка по времени не обнуляет кольцо, но красит его в красный: пользователь
 * должен видеть, сколько километров ещё есть, и одновременно понимать, что срок вышел.
 */

export type ResourceStatus = 'ok' | 'warn' | 'overdue' | 'no-data';

export interface Resource {
  status: ResourceStatus;
  /** 0..100; null, когда данных о замене нет. */
  value: number | null;
  /** Остаток пробега; отрицательное значение — перепробег. null, если интервал не задан. */
  kmLeft: number | null;
  /** Остаток в целых месяцах; отрицательное значение — просрочка. */
  monthsLeft: number | null;
  /** Шкала, по которой построено кольцо. */
  basis: 'km' | 'time' | null;
}

/** Ниже этого значения деталь попадает в блок «Требует внимания». */
export const WARN_THRESHOLD = 20;

const DAYS_PER_MONTH = 30.4375;

export interface LastChange {
  mileage: number;
  /** ISO-дата yyyy-mm-dd. */
  date: string;
}

export const NO_DATA: Resource = {
  status: 'no-data',
  value: null,
  kmLeft: null,
  monthsLeft: null,
  basis: null,
};

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
 * @param lastChange последняя замена — берётся исключительно из записей ТО
 * @param currentMileage текущий пробег машины
 * @param today ISO-дата «сегодня»; передаётся явно, чтобы расчёт был детерминированным
 */
export function calculateResource(
  part: Pick<Part, 'intervalKm' | 'intervalMonths'>,
  lastChange: LastChange | null,
  currentMileage: number,
  today: string,
): Resource {
  const hasInterval = part.intervalKm != null || part.intervalMonths != null;
  if (!lastChange || !hasInterval) return NO_DATA;

  const kmLeft =
    part.intervalKm != null ? part.intervalKm - (currentMileage - lastChange.mileage) : null;

  let monthsLeft: number | null = null;
  let timePercent: number | null = null;
  if (part.intervalMonths != null) {
    const intervalDays = part.intervalMonths * DAYS_PER_MONTH;
    const daysLeft = intervalDays - daysBetween(lastChange.date, today);
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

  return { status, value, kmLeft, monthsLeft, basis };
}

/** Прогресс до следующего регулярного ТО. Возвращает null, если регулярных ТО нет. */
export function calculateNextService(
  intervalKm: number,
  intervalMonths: number,
  lastScheduled: LastChange | null,
  currentMileage: number,
  today: string,
): (Resource & { dueAtMileage: number | null }) | null {
  if (intervalKm <= 0 && intervalMonths <= 0) return null;
  const resource = calculateResource(
    { intervalKm: intervalKm > 0 ? intervalKm : null, intervalMonths: intervalMonths > 0 ? intervalMonths : null },
    lastScheduled,
    currentMileage,
    today,
  );
  const dueAtMileage =
    lastScheduled && intervalKm > 0 ? lastScheduled.mileage + intervalKm : null;
  return { ...resource, dueAtMileage };
}
