import type { CategoryKey, FuelType, ReplacementScope, Transmission } from '../domain/types';

/**
 * Универсальный каталог деталей. Копируется в новую машину при её создании.
 *
 * Названия здесь не хранятся — они лежат в переводах под ключом `catalog.<key>`,
 * поэтому список остаётся локализуемым. Переименованная пользователем деталь
 * получает собственное название в БД и перестаёт зависеть от переводов.
 *
 * ГЛАВНОЕ ПРАВИЛО КАТАЛОГА: интервал ставится только там, где он действительно
 * существует в регламентах. Половина позиций автомобиля меняется не по сроку, а по
 * состоянию — шаровые опоры, ступичные подшипники, генератор, радиатор. Если проставить
 * им круглые числа «на глазок», приложение начнёт вечно требовать замены, которые никому
 * не нужны, и владелец перестанет верить остальным напоминаниям. Поэтому такие позиции
 * заводятся без интервалов: они лежат в каталоге выключенными, и их можно включить, чтобы
 * просто вести историю и расходы.
 */

/**
 * Как деталь меняется физически — см. `ReplacementScope` в доменных типах.
 * `each` самый коварный: деталей несколько, живут независимо, и замена одной ничего
 * не говорит об остальных, поэтому интервала такие позиции не получают.
 */
export interface CatalogEntry {
  key: string;
  category: CategoryKey;
  intervalKm: number | null;
  intervalMonths: number | null;
  scope: ReplacementScope;
  /** Если не указано — подходит любому типу топлива. */
  fuel?: FuelType[];
  /** Если не указано — подходит любой коробке. */
  transmission?: Transmission[];
}

const ICE: FuelType[] = ['petrol', 'diesel', 'hybrid'];
const PETROL: FuelType[] = ['petrol', 'hybrid'];

export const CATALOG: CatalogEntry[] = [
  // ── Двигатель ────────────────────────────────────────────────────────────
  { key: 'engine-oil', category: 'engine', intervalKm: 10_000, intervalMonths: 12, scope: 'single', fuel: ICE },
  { key: 'air-filter', category: 'engine', intervalKm: 30_000, intervalMonths: null, scope: 'single', fuel: ICE },
  // Свечей 3–6, но снимают и меняют всегда все разом.
  { key: 'spark-plugs', category: 'engine', intervalKm: 60_000, intervalMonths: null, scope: 'set', fuel: PETROL },
  { key: 'timing-belt', category: 'engine', intervalKm: 90_000, intervalMonths: 72, scope: 'set', fuel: ICE },
  { key: 'accessory-belt', category: 'engine', intervalKm: 90_000, intervalMonths: 60, scope: 'single', fuel: ICE },
  { key: 'pcv-valve', category: 'engine', intervalKm: 80_000, intervalMonths: null, scope: 'single', fuel: ICE },
  // Ниже — без регламента: меняют по отказу или по диагностике.
  { key: 'glow-plugs', category: 'engine', intervalKm: null, intervalMonths: null, scope: 'set', fuel: ['diesel'] },
  { key: 'timing-chain', category: 'engine', intervalKm: null, intervalMonths: null, scope: 'set', fuel: ICE },
  { key: 'engine-mounts', category: 'engine', intervalKm: null, intervalMonths: null, scope: 'each', fuel: ICE },
  { key: 'oxygen-sensor', category: 'engine', intervalKm: null, intervalMonths: null, scope: 'each', fuel: ICE },
  { key: 'catalytic-converter', category: 'engine', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },

  // ── Система охлаждения ───────────────────────────────────────────────────
  { key: 'coolant', category: 'cooling', intervalKm: 90_000, intervalMonths: 60, scope: 'single' },
  // Помпа на ременных моторах входит в комплект ГРМ — отдельного регламента у неё нет.
  { key: 'water-pump', category: 'cooling', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },
  { key: 'thermostat', category: 'cooling', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },
  { key: 'radiator', category: 'cooling', intervalKm: null, intervalMonths: null, scope: 'single' },

  // ── Топливная система ────────────────────────────────────────────────────
  // У дизеля фильтр — плановая позиция с календарём: он отделяет воду.
  { key: 'fuel-filter-diesel', category: 'fuel', intervalKm: 30_000, intervalMonths: 24, scope: 'single', fuel: ['diesel'] },
  { key: 'fuel-filter-petrol', category: 'fuel', intervalKm: 60_000, intervalMonths: null, scope: 'single', fuel: PETROL },
  { key: 'fuel-pump-strainer', category: 'fuel', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },
  { key: 'injectors-cleaning', category: 'fuel', intervalKm: null, intervalMonths: null, scope: 'set', fuel: ICE },
  { key: 'throttle-cleaning', category: 'fuel', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },

  // ── Трансмиссия ──────────────────────────────────────────────────────────
  { key: 'atf-and-filter', category: 'transmission', intervalKm: 60_000, intervalMonths: 96, scope: 'set', transmission: ['automatic'] },
  { key: 'manual-gearbox-oil', category: 'transmission', intervalKm: 80_000, intervalMonths: null, scope: 'single', transmission: ['manual'] },
  { key: 'clutch-kit', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'set', transmission: ['manual'] },
  // Пыльников и ШРУСов по четыре, рвутся поодиночке — общий счётчик им противопоказан.
  { key: 'cv-boots', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'cv-joints', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'each' },
  // Отдельного редуктора у переднеприводной машины нет; тип привода в модели пока не задаётся.
  { key: 'differential-oil', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'single' },

  // ── Тормозная система ────────────────────────────────────────────────────
  { key: 'front-brake-pads', category: 'brakes', intervalKm: 40_000, intervalMonths: null, scope: 'axle' },
  { key: 'rear-brake-pads', category: 'brakes', intervalKm: 70_000, intervalMonths: null, scope: 'axle' },
  { key: 'front-brake-discs', category: 'brakes', intervalKm: 90_000, intervalMonths: null, scope: 'axle' },
  { key: 'rear-brake-discs', category: 'brakes', intervalKm: 120_000, intervalMonths: null, scope: 'axle' },
  // Единственная позиция, где срок диктует календарь: жидкость набирает влагу из воздуха.
  { key: 'brake-fluid', category: 'brakes', intervalKm: null, intervalMonths: 24, scope: 'single' },
  { key: 'caliper-grease', category: 'brakes', intervalKm: null, intervalMonths: null, scope: 'axle' },
  { key: 'brake-hoses', category: 'brakes', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'parking-brake-shoes', category: 'brakes', intervalKm: null, intervalMonths: null, scope: 'axle' },

  // ── Подвеска и рулевое ───────────────────────────────────────────────────
  { key: 'front-shocks', category: 'suspension', intervalKm: 120_000, intervalMonths: null, scope: 'axle' },
  { key: 'rear-shocks', category: 'suspension', intervalKm: 140_000, intervalMonths: null, scope: 'axle' },
  // Тяг стабилизатора до четырёх, и передние с задними ходят по-разному — считаем по осям.
  { key: 'front-stabilizer-links', category: 'suspension', intervalKm: 70_000, intervalMonths: null, scope: 'axle' },
  { key: 'rear-stabilizer-links', category: 'suspension', intervalKm: 90_000, intervalMonths: null, scope: 'axle' },
  { key: 'strut-mounts', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'axle' },
  { key: 'springs', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'axle' },
  { key: 'stabilizer-bushings', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'axle' },
  { key: 'control-arm-bushings', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'ball-joints', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'wheel-bearings', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'tie-rod-ends', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'tie-rods', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  // На машинах с электроусилителем этой жидкости нет вовсе.
  { key: 'power-steering-fluid', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'single' },

  // ── Электрика ────────────────────────────────────────────────────────────
  // Аккумулятор умирает от календаря и жары; пробег с его ресурсом не связан.
  { key: 'battery', category: 'electrical', intervalKm: null, intervalMonths: 48, scope: 'single' },
  { key: 'low-beam-bulbs', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'alternator', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },
  { key: 'starter', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },

  // ── Салон и кузов ────────────────────────────────────────────────────────
  { key: 'cabin-filter', category: 'interior', intervalKm: 15_000, intervalMonths: 12, scope: 'single' },
  // Щётки убивают ультрафиолет и мороз, а не километры; передняя пара меняется вместе.
  { key: 'wiper-blades', category: 'interior', intervalKm: null, intervalMonths: 12, scope: 'set' },
  { key: 'rust-proofing', category: 'interior', intervalKm: null, intervalMonths: 12, scope: 'single' },

  // ── Шины и колёса ────────────────────────────────────────────────────────
  // У сезонного комплекта пробег заведомо врёт: машина полгода ездит на другом.
  // Поэтому у шин только возраст, а износ ловится перестановкой — её и считаем в километрах.
  { key: 'tire-rotation', category: 'wheels', intervalKm: 10_000, intervalMonths: null, scope: 'set' },
  { key: 'summer-tires', category: 'wheels', intervalKm: null, intervalMonths: 96, scope: 'set' },
  { key: 'winter-tires', category: 'wheels', intervalKm: null, intervalMonths: 72, scope: 'set' },
];

/**
 * Есть ли у детали срок жизни. Деталь без интервалов отслеживать нечем — ресурс не
 * посчитать, — поэтому в списке она заводится выключенной и живёт в каталоге, пока
 * пользователь сам не включит её показ.
 */
export function hasInterval(entry: Pick<CatalogEntry, 'intervalKm' | 'intervalMonths'>): boolean {
  return entry.intervalKm != null || entry.intervalMonths != null;
}

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

export const CATALOG_BY_KEY: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((entry) => [entry.key, entry]),
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
  'ac-recharge': 'interior',
};
