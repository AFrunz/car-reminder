import type { ServiceRecord } from './types';

/**
 * Пробег обязан монотонно расти вместе с датой. Две записи на одном пробеге допустимы,
 * а запись с более поздней датой и меньшим пробегом — нет: такая история не бывает у
 * исправного одометра, и допустив её, мы получили бы отрицательные остатки ресурса.
 */

export type ValidationCode =
  | 'date-in-future'
  | 'mileage-not-positive'
  | 'mileage-below-earlier-record'
  | 'mileage-above-later-record'
  | 'mileage-below-history';

export interface ValidationError {
  code: ValidationCode;
  /** Запись, с которой возник конфликт, — чтобы показать её в сообщении. */
  conflictsWith?: ServiceRecord;
}

export interface RecordCandidate {
  /** Задан при редактировании существующей записи — она исключается из проверки. */
  id?: string;
  date: string;
  mileage: number;
}

export function validateServiceRecord(
  candidate: RecordCandidate,
  existing: ServiceRecord[],
  today: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (candidate.date > today) errors.push({ code: 'date-in-future' });
  if (!Number.isFinite(candidate.mileage) || candidate.mileage < 0) {
    errors.push({ code: 'mileage-not-positive' });
  }

  for (const record of existing) {
    if (record.id === candidate.id) continue;
    if (record.date < candidate.date && record.mileage > candidate.mileage) {
      errors.push({ code: 'mileage-below-earlier-record', conflictsWith: record });
    }
    if (record.date > candidate.date && record.mileage < candidate.mileage) {
      errors.push({ code: 'mileage-above-later-record', conflictsWith: record });
    }
  }

  return errors;
}

/** Текущий пробег нельзя опустить ниже максимума, уже зафиксированного в истории. */
export function validateMileageUpdate(
  mileage: number,
  records: ServiceRecord[],
): ValidationError[] {
  if (!Number.isFinite(mileage) || mileage < 0) return [{ code: 'mileage-not-positive' }];
  const highest = records.reduce<ServiceRecord | null>(
    (max, r) => (max === null || r.mileage > max.mileage ? r : max),
    null,
  );
  if (highest && mileage < highest.mileage) {
    return [{ code: 'mileage-below-history', conflictsWith: highest }];
  }
  return [];
}

/** Фактический пробег машины: введённый вручную либо максимум из истории — что больше. */
export function effectiveMileage(manualMileage: number, records: ServiceRecord[]): number {
  return records.reduce((max, r) => Math.max(max, r.mileage), manualMileage);
}
