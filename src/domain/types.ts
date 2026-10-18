export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type ReplacementScope = 'single' | 'set' | 'axle' | 'each';
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
  intervalKm: number | null;
  intervalMonths: number | null;
  /**
   * Интервал проверки — третий, независимый от замены. Есть детали, которые меняют по
   * состоянию, но осматривают по регламенту: пыльники, шаровые, шланги. Проверка
   * сбрасывает только свой счётчик, замена — оба.
   */
  inspectKm: number | null;
  inspectMonths: number | null;
  /**
   * Измеряемый износ, мм: толщина новой детали и предел, на котором её меняют. Заданы
   * оба — при проверке можно вписать замер, и ресурс считается по нему, а не по интервалу.
   */
  wearNew: number | null;
  wearMin: number | null;
  /** Отслеживается ли деталь: выключенные не показываются на вкладке «Запчасти». */
  tracked: boolean;
  /** Закреплена в избранном — показывается отдельной секцией в самом верху списка. */
  pinned: boolean;
  custom: boolean;
  /** Как деталь меняется физически: целиком, по оси, поштучно. */
  scope: ReplacementScope;
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

/** Что сделали с деталью в записи ТО. У услуг всегда `replace` — значение по умолчанию. */
export type ItemAction = 'replace' | 'inspect';

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
  /** Свободная пометка к позиции: модель, артикул, что угодно. */
  note: string | null;
  action: ItemAction;
  /** Замер остатка при проверке, мм; null — не мерили. */
  measurement: number | null;
}

export interface ServiceRecordWithItems extends ServiceRecord {
  items: ServiceItem[];
}
