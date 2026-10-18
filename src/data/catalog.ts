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
 *
 * Зато у многих таких деталей есть регламент ОСМОТРА: «проверить при каждом ТО». Для них
 * заведён отдельный интервал проверки — он не требует замены, а напоминает посмотреть.
 * Особенно это выручает у `each`: общий счётчик замены им бессмыслен, а осматривают все
 * четыре пыльника разом, так что один счётчик проверки на всех честен.
 *
 * В каталоге лежат и регулярные работы, где ничего не меняется физически, — чистка
 * дросселя, развал-схождение, обслуживание кондиционера. Им нужен тот же счётчик,
 * что и деталям, а услуга в записи ТО счётчика не ведёт.
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
  /** Интервал проверки; не указан — регламента осмотра нет. */
  inspectKm?: number;
  inspectMonths?: number;
  /** Толщина новой детали и предел замены, мм, — для расчёта ресурса по замеру. */
  wearNew?: number;
  wearMin?: number;
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
  // Ремень меняют по сроку, но трещины на нём ищут каждые пару лет.
  { key: 'accessory-belt', category: 'engine', intervalKm: 90_000, intervalMonths: 60, scope: 'single', inspectKm: 30_000, inspectMonths: 24, fuel: ICE },
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
  // Регламента у производителей нет, но на деле дроссель чистят регулярно — иначе плывут обороты.
  { key: 'throttle-cleaning', category: 'fuel', intervalKm: 30_000, intervalMonths: null, scope: 'single', fuel: ICE },

  // ── Трансмиссия ──────────────────────────────────────────────────────────
  { key: 'atf-and-filter', category: 'transmission', intervalKm: 60_000, intervalMonths: 96, scope: 'set', transmission: ['automatic'] },
  { key: 'manual-gearbox-oil', category: 'transmission', intervalKm: 80_000, intervalMonths: null, scope: 'single', transmission: ['manual'] },
  { key: 'clutch-kit', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'set', transmission: ['manual'] },
  // Пыльников и ШРУСов по четыре, рвутся поодиночке — общий счётчик им противопоказан.
  // Но осматривают их все разом при каждом ТО: порванный пыльник за сезон убивает ШРУС.
  { key: 'cv-boots', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'each', inspectKm: 15_000, inspectMonths: 12 },
  { key: 'cv-joints', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'each' },
  // Отдельного редуктора у переднеприводной машины нет; тип привода в модели пока не задаётся.
  { key: 'differential-oil', category: 'transmission', intervalKm: null, intervalMonths: null, scope: 'single' },

  // ── Тормозная система ────────────────────────────────────────────────────
  // Колодки — главный кандидат на замер: толщина накладки прямо говорит, сколько им осталось.
  { key: 'front-brake-pads', category: 'brakes', intervalKm: 40_000, intervalMonths: null, scope: 'axle', inspectKm: 15_000, inspectMonths: 12, wearNew: 12, wearMin: 3 },
  { key: 'rear-brake-pads', category: 'brakes', intervalKm: 70_000, intervalMonths: null, scope: 'axle', inspectKm: 15_000, inspectMonths: 12, wearNew: 10, wearMin: 3 },
  { key: 'front-brake-discs', category: 'brakes', intervalKm: 90_000, intervalMonths: null, scope: 'axle' },
  { key: 'rear-brake-discs', category: 'brakes', intervalKm: 120_000, intervalMonths: null, scope: 'axle' },
  // Единственная позиция, где срок диктует календарь: жидкость набирает влагу из воздуха.
  { key: 'brake-fluid', category: 'brakes', intervalKm: null, intervalMonths: 24, scope: 'single' },
  // Направляющие закисают от соли и влаги — их обслуживают по календарю, а не по пробегу.
  { key: 'caliper-grease', category: 'brakes', intervalKm: null, intervalMonths: 24, scope: 'axle' },
  { key: 'brake-hoses', category: 'brakes', intervalKm: null, intervalMonths: null, scope: 'each', inspectMonths: 24 },
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
  // Люфты и порванные пыльники ловятся только осмотром на подъёмнике — его и напоминаем.
  { key: 'control-arm-bushings', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each', inspectKm: 30_000 },
  { key: 'ball-joints', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each', inspectKm: 30_000 },
  { key: 'wheel-bearings', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'tie-rod-ends', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each', inspectKm: 30_000 },
  { key: 'tie-rods', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'each' },
  // На машинах с электроусилителем этой жидкости нет вовсе.
  { key: 'power-steering-fluid', category: 'suspension', intervalKm: null, intervalMonths: null, scope: 'single' },

  // ── Электрика ────────────────────────────────────────────────────────────
  // Аккумулятор умирает от календаря и жары; пробег с его ресурсом не связан.
  // Нагрузочную вилку — раз в год, перед зимой: севший на морозе аккумулятор не заведёт.
  { key: 'battery', category: 'electrical', intervalKm: null, intervalMonths: 48, scope: 'single', inspectMonths: 12 },
  { key: 'low-beam-bulbs', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'each' },
  { key: 'alternator', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },
  { key: 'starter', category: 'electrical', intervalKm: null, intervalMonths: null, scope: 'single', fuel: ICE },

  // ── Салон и кузов ────────────────────────────────────────────────────────
  { key: 'cabin-filter', category: 'interior', intervalKm: 15_000, intervalMonths: 12, scope: 'single' },
  // Щётки убивают ультрафиолет и мороз, а не километры, но и они могут прослужить не один
  // сезон — поэтому раз в год проверяем, а меняем по состоянию. Передняя пара меняется вместе.
  { key: 'wiper-blades', category: 'interior', intervalKm: null, intervalMonths: null, scope: 'set', inspectMonths: 12 },
  // Кондиционер: заправка с проверкой герметичности и антибактериальная чистка — разные ритмы.
  { key: 'ac-service', category: 'interior', intervalKm: null, intervalMonths: 24, scope: 'single' },
  { key: 'ac-disinfection', category: 'interior', intervalKm: null, intervalMonths: 12, scope: 'single' },

  // ── Шины и колёса ────────────────────────────────────────────────────────
  // У сезонного комплекта пробег заведомо врёт: машина полгода ездит на другом.
  // Поэтому у шин только возраст, а износ ловится перестановкой — её и считаем в километрах.
  // Протектор меряют при сезонной смене. Пределы — законные минимумы в РФ: 1,6 мм у
  // летних и 4 мм у зимних; новые — типичная глубина рисунка.
  { key: 'tire-rotation', category: 'wheels', intervalKm: 10_000, intervalMonths: null, scope: 'set' },
  { key: 'summer-tires', category: 'wheels', intervalKm: null, intervalMonths: 96, scope: 'set', inspectMonths: 12, wearNew: 8, wearMin: 1.6 },
  { key: 'winter-tires', category: 'wheels', intervalKm: null, intervalMonths: 72, scope: 'set', inspectMonths: 12, wearNew: 9, wearMin: 4 },
  // Геометрию сбивают ямы, а не километры, поэтому раз в год — даже если ездили мало.
  { key: 'wheel-alignment', category: 'wheels', intervalKm: 20_000, intervalMonths: 12, scope: 'single' },
];

interface Intervals {
  intervalKm: number | null;
  intervalMonths: number | null;
  inspectKm?: number | null;
  inspectMonths?: number | null;
}

/**
 * Есть ли у детали хоть какой-то срок — замены или проверки. Деталь без интервалов
 * отслеживать нечем, поэтому в списке она заводится выключенной и живёт в каталоге,
 * пока пользователь сам не включит её показ.
 */
export function hasInterval(entry: Intervals): boolean {
  return (
    entry.intervalKm != null ||
    entry.intervalMonths != null ||
    entry.inspectKm != null ||
    entry.inspectMonths != null
  );
}

/**
 * Насколько часто деталь меняют — по этому значению строятся все списки: то, что
 * трогают каждое ТО, должно быть под рукой, а не в конце списка из полусотни позиций.
 * Временной интервал переводим в километры по грубой оценке 1000 км в месяц, иначе
 * детали вроде салонного фильтра или тормозной жидкости, у которых срок диктует время,
 * оказались бы рядом с деталями на сто тысяч пробега.
 *
 * Деталь, которую не меняют, а только осматривают, встаёт по частоте осмотра — иначе
 * пыльники, которые смотрят каждое ТО, уехали бы в самый конец.
 */
function rank(km: number | null | undefined, months: number | null | undefined): number {
  const byKm = km ?? Number.POSITIVE_INFINITY;
  const byMonths = months != null ? months * 1000 : Number.POSITIVE_INFINITY;
  return Math.min(byKm, byMonths);
}

export function replacementRank(entry: Intervals): number {
  const byReplacement = rank(entry.intervalKm, entry.intervalMonths);
  return Number.isFinite(byReplacement)
    ? byReplacement
    : rank(entry.inspectKm, entry.inspectMonths);
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

/**
 * Частые услуги — подсказки при вводе, справочником не являются. Развал-схождение и
 * кондиционер отсюда ушли в каталог: у них есть ритм, и счётчик им нужен, как детали.
 */
export const COMMON_SERVICES = [
  'oil-change-labour',
  'diagnostics',
  'tire-fitting',
  'balancing',
  'car-wash',
] as const;

/** Категория по умолчанию для подсказанной услуги. */
export const COMMON_SERVICE_CATEGORY: Record<string, CategoryKey> = {
  'oil-change-labour': 'engine',
  diagnostics: 'engine',
  'tire-fitting': 'wheels',
  balancing: 'wheels',
  'car-wash': 'interior',
};
