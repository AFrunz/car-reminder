export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type Transmission = 'manual' | 'automatic';

export const CATEGORY_KEYS = [
  'engine',
  'cooling',
  'fuel',
  'transmission',
  'brakes',
  'suspension',
  'electrical',
  'interior',
  'wheels',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  fuel: FuelType;
  transmission: Transmission;
  /** Пробег, введённый пользователем вручную. Фактический — max с пробегом из истории. */
  mileage: number;
  /** 0 означает, что регулярных ТО нет и карточка «Следующее ТО» не показывается. */
  serviceIntervalKm: number;
  serviceIntervalMonths: number;
  createdAt: string;
}

export interface Part {
  id: string;
  carId: string;
  /** Ключ позиции универсального каталога; null у своих деталей. */
  catalogKey: string | null;
  /**
   * Собственное название. null означает «берём перевод по catalogKey» — так каталожные
   * детали остаются локализуемыми, а переименованные навсегда получают своё имя.
   */
  name: string | null;
  categoryKey: CategoryKey;
  /** Хотя бы один из интервалов обязателен. */
  intervalKm: number | null;
  intervalMonths: number | null;
  /** Отслеживается ли деталь: выключенные не показываются на вкладке «Запчасти». */
  tracked: boolean;
  custom: boolean;
  sortOrder: number;
}

export type ServiceKind = 'scheduled' | 'unscheduled';

export interface ServiceRecord {
  id: string;
  carId: string;
  /** ISO-дата yyyy-mm-dd. */
  date: string;
  mileage: number;
  kind: ServiceKind;
  /** Произвольная итоговая сумма за ТО; null — цена не указана. */
  totalCost: number | null;
  createdAt: string;
}

export type ServiceItemType = 'part' | 'service';

export interface ServiceItem {
  id: string;
  recordId: string;
  type: ServiceItemType;
  /** Ссылка на деталь; null у услуг. */
  partId: string | null;
  /** Название услуги (свободный ввод). У деталей null — имя берётся из самой детали. */
  name: string | null;
  categoryKey: CategoryKey;
  cost: number | null;
}

export interface ServiceRecordWithItems extends ServiceRecord {
  items: ServiceItem[];
}
