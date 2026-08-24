import type { CategoryKey, FuelType, Transmission } from '../domain/types';

/**
 * Универсальный каталог деталей. Копируется в новую машину при её создании,
 * отфильтрованный по типу топлива и коробке передач.
 *
 * Названия здесь не хранятся — они лежат в переводах под ключом `catalog.<key>`,
 * поэтому список остаётся локализуемым. Переименованная пользователем деталь
 * получает собственное название в БД и перестаёт зависеть от переводов.
 */

export interface CatalogEntry {
  key: string;
  category: CategoryKey;
  intervalKm: number | null;
  intervalMonths: number | null;
  /** Если не указано — подходит любому типу топлива. */
  fuel?: FuelType[];
  /** Если не указано — подходит любой коробке. */
  transmission?: Transmission[];
}

const ICE: FuelType[] = ['petrol', 'diesel', 'hybrid'];

export const CATALOG: CatalogEntry[] = [
  // Двигатель
  { key: 'engine-oil', category: 'engine', intervalKm: 10_000, intervalMonths: 12, fuel: ICE },
  { key: 'air-filter', category: 'engine', intervalKm: 20_000, intervalMonths: 24, fuel: ICE },
  { key: 'spark-plugs', category: 'engine', intervalKm: 30_000, intervalMonths: 36, fuel: ['petrol', 'hybrid'] },
  { key: 'glow-plugs', category: 'engine', intervalKm: 100_000, intervalMonths: 60, fuel: ['diesel'] },
  { key: 'timing-belt', category: 'engine', intervalKm: 90_000, intervalMonths: 84, fuel: ICE },
  { key: 'timing-chain', category: 'engine', intervalKm: 150_000, intervalMonths: null, fuel: ICE },
  { key: 'accessory-belt', category: 'engine', intervalKm: 60_000, intervalMonths: 60, fuel: ICE },
  { key: 'pcv-valve', category: 'engine', intervalKm: 60_000, intervalMonths: null, fuel: ICE },
  { key: 'engine-mounts', category: 'engine', intervalKm: 100_000, intervalMonths: null, fuel: ICE },
  { key: 'oxygen-sensor', category: 'engine', intervalKm: 100_000, intervalMonths: null, fuel: ICE },
  { key: 'catalytic-converter', category: 'engine', intervalKm: 150_000, intervalMonths: null, fuel: ICE },

  // Система охлаждения
  { key: 'coolant', category: 'cooling', intervalKm: 60_000, intervalMonths: 48 },
  { key: 'thermostat', category: 'cooling', intervalKm: 100_000, intervalMonths: null, fuel: ICE },
  { key: 'water-pump', category: 'cooling', intervalKm: 90_000, intervalMonths: 84, fuel: ICE },
  { key: 'radiator', category: 'cooling', intervalKm: 120_000, intervalMonths: null },

  // Топливная система
  { key: 'fuel-filter', category: 'fuel', intervalKm: 30_000, intervalMonths: 24, fuel: ICE },
  { key: 'fuel-pump-strainer', category: 'fuel', intervalKm: 60_000, intervalMonths: null, fuel: ICE },
  { key: 'injectors-cleaning', category: 'fuel', intervalKm: 60_000, intervalMonths: null, fuel: ICE },
  { key: 'throttle-cleaning', category: 'fuel', intervalKm: 60_000, intervalMonths: null, fuel: ICE },

  // Трансмиссия
  { key: 'atf-and-filter', category: 'transmission', intervalKm: 60_000, intervalMonths: 48, transmission: ['automatic'] },
  { key: 'manual-gearbox-oil', category: 'transmission', intervalKm: 80_000, intervalMonths: 60, transmission: ['manual'] },
  { key: 'clutch-kit', category: 'transmission', intervalKm: 120_000, intervalMonths: null, transmission: ['manual'] },
  { key: 'differential-oil', category: 'transmission', intervalKm: 60_000, intervalMonths: 48 },
  { key: 'cv-boots', category: 'transmission', intervalKm: 60_000, intervalMonths: null },
  { key: 'cv-joints', category: 'transmission', intervalKm: 120_000, intervalMonths: null },

  // Тормозная система
  { key: 'front-brake-pads', category: 'brakes', intervalKm: 30_000, intervalMonths: 36 },
  { key: 'rear-brake-pads', category: 'brakes', intervalKm: 50_000, intervalMonths: 48 },
  { key: 'front-brake-discs', category: 'brakes', intervalKm: 60_000, intervalMonths: null },
  { key: 'rear-brake-discs', category: 'brakes', intervalKm: 90_000, intervalMonths: null },
  { key: 'brake-fluid', category: 'brakes', intervalKm: 60_000, intervalMonths: 24 },
  { key: 'brake-hoses', category: 'brakes', intervalKm: 120_000, intervalMonths: 96 },
  { key: 'parking-brake-shoes', category: 'brakes', intervalKm: 100_000, intervalMonths: null },

  // Подвеска и рулевое
  { key: 'front-shocks', category: 'suspension', intervalKm: 80_000, intervalMonths: 72 },
  { key: 'rear-shocks', category: 'suspension', intervalKm: 90_000, intervalMonths: 72 },
  { key: 'strut-mounts', category: 'suspension', intervalKm: 80_000, intervalMonths: null },
  { key: 'springs', category: 'suspension', intervalKm: 120_000, intervalMonths: null },
  { key: 'stabilizer-links', category: 'suspension', intervalKm: 40_000, intervalMonths: 36 },
  { key: 'stabilizer-bushings', category: 'suspension', intervalKm: 60_000, intervalMonths: null },
  { key: 'control-arm-bushings', category: 'suspension', intervalKm: 100_000, intervalMonths: null },
  { key: 'ball-joints', category: 'suspension', intervalKm: 80_000, intervalMonths: null },
  { key: 'wheel-bearings', category: 'suspension', intervalKm: 100_000, intervalMonths: null },
  { key: 'tie-rod-ends', category: 'suspension', intervalKm: 80_000, intervalMonths: null },
  { key: 'tie-rods', category: 'suspension', intervalKm: 100_000, intervalMonths: null },
  { key: 'power-steering-fluid', category: 'suspension', intervalKm: 60_000, intervalMonths: 48 },

  // Электрика
  { key: 'battery', category: 'electrical', intervalKm: 100_000, intervalMonths: 48 },
  { key: 'alternator', category: 'electrical', intervalKm: 120_000, intervalMonths: null, fuel: ICE },
  { key: 'starter', category: 'electrical', intervalKm: 150_000, intervalMonths: null, fuel: ICE },
  { key: 'low-beam-bulbs', category: 'electrical', intervalKm: 60_000, intervalMonths: 36 },

  // Салон и кузов
  { key: 'cabin-filter', category: 'interior', intervalKm: 15_000, intervalMonths: 12 },
  { key: 'wiper-blades', category: 'interior', intervalKm: 20_000, intervalMonths: 12 },
  { key: 'rust-proofing', category: 'interior', intervalKm: null, intervalMonths: 24 },

  // Шины и колёса
  { key: 'summer-tires', category: 'wheels', intervalKm: 50_000, intervalMonths: 72 },
  { key: 'winter-tires', category: 'wheels', intervalKm: 50_000, intervalMonths: 72 },
];

/**
 * Насколько часто деталь меняют — по этому значению строятся все списки: то, что
 * трогают каждое ТО, должно быть под рукой, а не в конце списка из полусотни позиций.
 * Временной интервал переводим в километры по грубой оценке 1000 км в месяц, иначе
 * детали вроде салонного фильтра или тормозной жидкости, у которых срок диктует время,
 * оказались бы рядом с деталями на сто тысяч пробега.
 */
export function replacementRank(entry: Pick<CatalogEntry, 'intervalKm' | 'intervalMonths'>): number {
  const byKm = entry.intervalKm ?? Number.POSITIVE_INFINITY;
  const byMonths =
    entry.intervalMonths != null ? entry.intervalMonths * 1000 : Number.POSITIVE_INFINITY;
  return Math.min(byKm, byMonths);
}

/** Каталог в порядке убывания частоты замены — именно он определяет порядок в списках. */
export const CATALOG_BY_FREQUENCY: CatalogEntry[] = [...CATALOG].sort(
  (a, b) => replacementRank(a) - replacementRank(b),
);

/** Подходит ли позиция каталога конкретной машине. */
export function isApplicable(
  entry: CatalogEntry,
  fuel: FuelType,
  transmission: Transmission,
): boolean {
  if (entry.fuel && !entry.fuel.includes(fuel)) return false;
  if (entry.transmission && !entry.transmission.includes(transmission)) return false;
  return true;
}

/**
 * Причина, по которой позиция выключена для этой машины, — показывается подписью
 * в каталоге, чтобы выключенная деталь не выглядела случайно снятой.
 */
export function inapplicableReason(entry: CatalogEntry): string | null {
  if (entry.fuel) {
    if (entry.fuel.length === 1) return `fuel.${entry.fuel[0]}`;
    return 'fuel.combustion';
  }
  if (entry.transmission && entry.transmission.length === 1) {
    return `transmission.${entry.transmission[0]}`;
  }
  return null;
}

/** Частые услуги — подсказки при вводе, справочником не являются. */
export const COMMON_SERVICES = [
  'oil-change-labour',
  'diagnostics',
  'wheel-alignment',
  'tire-fitting',
  'balancing',
  'car-wash',
  'throttle-cleaning',
  'ac-recharge',
] as const;

/** Категория по умолчанию для подсказанной услуги. */
export const COMMON_SERVICE_CATEGORY: Record<string, CategoryKey> = {
  'oil-change-labour': 'engine',
  diagnostics: 'engine',
  'wheel-alignment': 'suspension',
  'tire-fitting': 'wheels',
  balancing: 'wheels',
  'car-wash': 'interior',
  'throttle-cleaning': 'engine',
  'ac-recharge': 'interior',
};
