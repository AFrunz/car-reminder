import * as SQLite from 'expo-sqlite';
import { getLocales } from 'expo-localization';
import { CATALOG, CATALOG_BY_FREQUENCY, CATALOG_BY_KEY, hasInterval, isApplicable } from '../data/catalog';
import type { FuelType, Transmission } from '../domain/types';
import { localIsoDate } from '../lib/format';

interface CarRowForSync {
  id: string;
  fuel: string;
  transmission: string;
}

/**
 * Приводит набор деталей машины к текущему каталогу: недостающие позиции заводит,
 * существующим обновляет порядок. Вызывается из миграций — каталог пополняется с
 * версиями приложения, и уже заведённые машины должны получать новые позиции.
 *
 * ВАЖНО: функция вызывается из СТАРЫХ миграций, поэтому обязана обходиться колонками,
 * которые существовали на момент самой ранней из них. Добавишь сюда колонку, добавленную
 * поздней миграцией, — и обновление сломается у всех, кто ещё не дошёл до неё: старая
 * миграция упадёт на несуществующем столбце. Значения по умолчанию таким колонкам
 * проставляет та миграция, которая их вводит.
 *
 * Деталь без единого интервала заводится выключенной: ресурс у неё посчитать нечем,
 * в списке отслеживания ей делать нечего, но в каталоге она доступна для включения.
 */
async function syncCatalogForCar(db: SQLite.SQLiteDatabase, car: CarRowForSync): Promise<void> {
  const existing = await db.getAllAsync<{ catalog_key: string | null }>(
    'SELECT catalog_key FROM parts WHERE car_id = ?',
    car.id,
  );
  const known = new Set(existing.map((row) => row.catalog_key).filter(Boolean));

  for (let i = 0; i < CATALOG_BY_FREQUENCY.length; i += 1) {
    const entry = CATALOG_BY_FREQUENCY[i];
    if (known.has(entry.key)) {
      await db.runAsync(
        'UPDATE parts SET sort_order = ? WHERE car_id = ? AND catalog_key = ?',
        i,
        car.id,
        entry.key,
      );
      continue;
    }
    const tracked =
      isApplicable(entry, car.fuel as FuelType, car.transmission as Transmission) &&
      hasInterval(entry);
    await db.runAsync(
      `INSERT INTO parts (id, car_id, catalog_key, name, category_key,
        interval_km, interval_months, tracked, custom, sort_order)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, ?)`,
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      car.id,
      entry.key,
      entry.category,
      entry.intervalKm,
      entry.intervalMonths,
      tracked ? 1 : 0,
      i,
    );
  }
  // Свои детали остаются в конце списка, сохраняя относительный порядок.
  await db.runAsync(
    'UPDATE parts SET sort_order = sort_order + ? WHERE car_id = ? AND catalog_key IS NULL',
    CATALOG_BY_FREQUENCY.length,
    car.id,
  );
}

/**
 * Интервалы, стоявшие в каталоге до ревизии. Нужны ровно для одного: понять, правил ли
 * пользователь значение под свою машину. Если правил — новое умолчание ему не навязываем.
 */
const LEGACY_DEFAULTS: Record<string, [number | null, number | null]> = {
  'air-filter': [20_000, 24], 'spark-plugs': [30_000, 36], 'glow-plugs': [100_000, 60],
  'timing-belt': [90_000, 84], 'timing-chain': [150_000, null], 'accessory-belt': [60_000, 60],
  'pcv-valve': [60_000, null], 'engine-mounts': [100_000, null], 'oxygen-sensor': [100_000, null],
  'catalytic-converter': [150_000, null], coolant: [60_000, 48], thermostat: [100_000, null],
  'water-pump': [90_000, 84], radiator: [120_000, null],
  'fuel-filter-diesel': [30_000, 24], 'fuel-filter-petrol': [30_000, 24],
  'fuel-pump-strainer': [60_000, null], 'injectors-cleaning': [60_000, null],
  'throttle-cleaning': [60_000, null], 'atf-and-filter': [60_000, 48],
  'manual-gearbox-oil': [80_000, 60], 'clutch-kit': [120_000, null],
  'differential-oil': [60_000, 48], 'cv-boots': [60_000, null], 'cv-joints': [120_000, null],
  'front-brake-pads': [30_000, 36], 'rear-brake-pads': [50_000, 48],
  'front-brake-discs': [60_000, null], 'rear-brake-discs': [90_000, null],
  'brake-fluid': [60_000, 24], 'brake-hoses': [120_000, 96],
  'parking-brake-shoes': [100_000, null], 'front-shocks': [80_000, 72],
  'rear-shocks': [90_000, 72], 'strut-mounts': [80_000, null], springs: [120_000, null],
  'front-stabilizer-links': [40_000, 36], 'stabilizer-bushings': [60_000, null],
  'control-arm-bushings': [100_000, null], 'ball-joints': [80_000, null],
  'wheel-bearings': [100_000, null], 'tie-rod-ends': [80_000, null], 'tie-rods': [100_000, null],
  'power-steering-fluid': [60_000, 48], battery: [100_000, 48], alternator: [120_000, null],
  starter: [150_000, null], 'low-beam-bulbs': [60_000, 36], 'wiper-blades': [20_000, 12],
  'rust-proofing': [null, 24], 'summer-tires': [50_000, 72], 'winter-tires': [50_000, 72],
};

/**
 * Ревизия каталога с проверками: эти позиции раньше жили без единого интервала и
 * потому лежали выключенными. Теперь у них есть срок — замены или осмотра, — и их
 * пора показать. Включаем только там, где деталь подходит машине.
 */
const NEWLY_TRACKABLE = [
  'throttle-cleaning',
  'caliper-grease',
  'cv-boots',
  'brake-hoses',
  'control-arm-bushings',
  'ball-joints',
  'tie-rod-ends',
];

/** Прежние интервалы замены тех позиций, которым ревизия с проверками их поменяла. */
const REVISION_2_PREVIOUS: Record<string, [number | null, number | null]> = {
  'throttle-cleaning': [null, null],
  'caliper-grease': [null, null],
  // Щётки перестали меняться по сроку — теперь их раз в год проверяют.
  'wiper-blades': [null, 12],
};

/** Названия удалённой из каталога антикоррозийки — для тех, у кого по ней есть история. */
const RUST_PROOFING_NAME = { ru: 'Антикоррозийная обработка', en: 'Rust proofing' };

/**
 * Склеивает задвоенные каталожные позиции машины. Задвоение получали все, кто обновлялся
 * с релизов до ревизии каталога: догрузка каталога в ранних миграциях заводила деталь под
 * новым ключом, а следом переименование старого ключа давало второй такой же. Оставляем
 * позицию с историей, записи ТО с остальных переводим на неё.
 */
async function mergeDuplicateParts(db: SQLite.SQLiteDatabase): Promise<void> {
  const groups = await db.getAllAsync<{ car_id: string; catalog_key: string }>(
    `SELECT car_id, catalog_key FROM parts WHERE catalog_key IS NOT NULL
     GROUP BY car_id, catalog_key HAVING COUNT(*) > 1`,
  );
  for (const group of groups) {
    const rows = await db.getAllAsync<{ id: string; pinned: number }>(
      `SELECT p.id AS id, p.pinned AS pinned,
         (SELECT COUNT(*) FROM service_items i WHERE i.part_id = p.id) AS used
       FROM parts p WHERE p.car_id = ? AND p.catalog_key = ?
       ORDER BY used DESC, p.sort_order ASC`,
      group.car_id,
      group.catalog_key,
    );
    const [keeper, ...rest] = rows;
    for (const row of rest) {
      await db.runAsync('UPDATE service_items SET part_id = ? WHERE part_id = ?', keeper.id, row.id);
      if (row.pinned === 1) await db.runAsync('UPDATE parts SET pinned = 1 WHERE id = ?', keeper.id);
      await db.runAsync('DELETE FROM parts WHERE id = ?', row.id);
    }
  }
}

export const DATABASE_NAME = 'car-reminder.db';

let database: SQLite.SQLiteDatabase | null = null;

/**
 * Каждая миграция — шаг от предыдущей версии схемы к следующей. Номер последней
 * применённой хранится в `PRAGMA user_version`, поэтому обновление приложения
 * догоняет схему, не трогая пользовательские данные. Шаг может быть как готовым
 * SQL, так и функцией — когда данные нужно пересчитать по коду приложения.
 */
type Migration = string | ((db: SQLite.SQLiteDatabase) => Promise<void>);

const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE cars (
    id TEXT PRIMARY KEY NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    fuel TEXT NOT NULL,
    transmission TEXT NOT NULL,
    mileage INTEGER NOT NULL DEFAULT 0,
    service_interval_km INTEGER NOT NULL DEFAULT 10000,
    service_interval_months INTEGER NOT NULL DEFAULT 12,
    created_at TEXT NOT NULL
  );

  CREATE TABLE parts (
    id TEXT PRIMARY KEY NOT NULL,
    car_id TEXT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    catalog_key TEXT,
    name TEXT,
    category_key TEXT NOT NULL,
    interval_km INTEGER,
    interval_months INTEGER,
    tracked INTEGER NOT NULL DEFAULT 1,
    custom INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_parts_car ON parts(car_id);

  CREATE TABLE service_records (
    id TEXT PRIMARY KEY NOT NULL,
    car_id TEXT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    kind TEXT NOT NULL,
    total_cost REAL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_records_car ON service_records(car_id, mileage DESC);

  CREATE TABLE service_items (
    id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    part_id TEXT REFERENCES parts(id) ON DELETE SET NULL,
    name TEXT,
    category_key TEXT NOT NULL,
    cost REAL
  );
  CREATE INDEX idx_items_record ON service_items(record_id);
  CREATE INDEX idx_items_part ON service_items(part_id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,

  /**
   * Порядок деталей стал строиться по частоте замены, и в каталоге появились новые
   * позиции. Уже заведённым машинам обе правки нужно доставить: иначе у старой машины
   * список остался бы в исходном порядке и без новых деталей.
   */
  async (db) => {
    const cars = await db.getAllAsync<CarRowForSync>('SELECT id, fuel, transmission FROM cars');
    for (const car of cars) await syncCatalogForCar(db, car);
  },

  /**
   * У позиции ТО появился свободный комментарий — модель, артикул, любая пометка.
   * Заодно догоняем каталог: в нём появилась смазка суппортов, деталь без интервалов.
   */
  async (db) => {
    await db.execAsync('ALTER TABLE service_items ADD COLUMN note TEXT');
    const cars = await db.getAllAsync<CarRowForSync>('SELECT id, fuel, transmission FROM cars');
    for (const car of cars) await syncCatalogForCar(db, car);
  },

  /** Избранные детали: закреплённые показываются отдельной секцией в начале списка. */
  'ALTER TABLE parts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',

  /**
   * Ревизия каталога по регламентам производителей. Половина позиций лишилась
   * интервалов: у них нет нормированного срока, их меняют по состоянию, и круглые
   * числа «на глазок» заставляли приложение вечно требовать ненужных замен. Часть
   * интервалов исправлена, тяги стабилизатора и топливный фильтр разнесены, появилось
   * поле кратности замены.
   *
   * Значения, которые пользователь правил под свою машину, не трогаем: обновляем
   * только те, что совпадают со старым значением по умолчанию.
   */
  async (db) => {
    await db.execAsync("ALTER TABLE parts ADD COLUMN scope TEXT NOT NULL DEFAULT 'single'");

    const cars = await db.getAllAsync<CarRowForSync>('SELECT id, fuel, transmission FROM cars');
    for (const car of cars) {
      // Разнесённые позиции переносим на новые ключи, иначе они осиротеют и задвоятся.
      await db.runAsync(
        'UPDATE parts SET catalog_key = ? WHERE car_id = ? AND catalog_key = ?',
        car.fuel === 'diesel' ? 'fuel-filter-diesel' : 'fuel-filter-petrol',
        car.id,
        'fuel-filter',
      );
      await db.runAsync(
        'UPDATE parts SET catalog_key = ? WHERE car_id = ? AND catalog_key = ?',
        'front-stabilizer-links',
        car.id,
        'stabilizer-links',
      );

      for (const [key, [oldKm, oldMonths]] of Object.entries(LEGACY_DEFAULTS)) {
        const entry = CATALOG_BY_KEY[key];
        if (!entry) continue;
        await db.runAsync(
          `UPDATE parts SET interval_km = ?, interval_months = ?, tracked = ?
           WHERE car_id = ? AND catalog_key = ?
             AND interval_km IS ? AND interval_months IS ?`,
          entry.intervalKm,
          entry.intervalMonths,
          hasInterval(entry) &&
            isApplicable(entry, car.fuel as FuelType, car.transmission as Transmission)
            ? 1
            : 0,
          car.id,
          key,
          oldKm,
          oldMonths,
        );
      }

      await syncCatalogForCar(db, car);

      // После догрузки каталога — кратность замены всем позициям, включая новые.
      for (const entry of CATALOG) {
        await db.runAsync(
          'UPDATE parts SET scope = ? WHERE car_id = ? AND catalog_key = ?',
          entry.scope,
          car.id,
          entry.key,
        );
      }
    }
  },

  /**
   * Проверки и замеры. У детали появился третий интервал — осмотра — и параметры износа
   * для расчёта по замеру; у позиции записи ТО — действие (замена или проверка) и замер.
   * Каталог пополнился регулярными работами, антикоррозийка из него ушла.
   */
  async (db) => {
    await db.execAsync(`
      ALTER TABLE parts ADD COLUMN inspect_km INTEGER;
      ALTER TABLE parts ADD COLUMN inspect_months INTEGER;
      ALTER TABLE parts ADD COLUMN wear_new REAL;
      ALTER TABLE parts ADD COLUMN wear_min REAL;
      ALTER TABLE service_items ADD COLUMN action TEXT NOT NULL DEFAULT 'replace';
      ALTER TABLE service_items ADD COLUMN measurement REAL;
    `);

    await mergeDuplicateParts(db);

    // Антикоррозийку без истории просто убираем; с историей — оставляем своей деталью,
    // чтобы записи ТО не потеряли позицию, а название не зависело от перевода.
    const language = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'language'",
    );
    const lang = (language?.value ?? getLocales()[0]?.languageCode) === 'ru' ? 'ru' : 'en';
    await db.runAsync(
      `DELETE FROM parts WHERE catalog_key = 'rust-proofing'
         AND id NOT IN (SELECT part_id FROM service_items WHERE part_id IS NOT NULL)`,
    );
    await db.runAsync(
      `UPDATE parts SET catalog_key = NULL, custom = 1, name = COALESCE(name, ?)
       WHERE catalog_key = 'rust-proofing'`,
      RUST_PROOFING_NAME[lang],
    );

    const cars = await db.getAllAsync<CarRowForSync>('SELECT id, fuel, transmission FROM cars');
    for (const car of cars) {
      for (const [key, [oldKm, oldMonths]] of Object.entries(REVISION_2_PREVIOUS)) {
        const entry = CATALOG_BY_KEY[key];
        await db.runAsync(
          `UPDATE parts SET interval_km = ?, interval_months = ?
           WHERE car_id = ? AND catalog_key = ? AND interval_km IS ? AND interval_months IS ?`,
          entry.intervalKm,
          entry.intervalMonths,
          car.id,
          key,
          oldKm,
          oldMonths,
        );
      }

      await syncCatalogForCar(db, car);

      // Проверка и износ — новые колонки, своих значений у пользователя в них быть не может.
      for (const entry of CATALOG) {
        await db.runAsync(
          `UPDATE parts SET inspect_km = ?, inspect_months = ?, wear_new = ?, wear_min = ?, scope = ?
           WHERE car_id = ? AND catalog_key = ?`,
          entry.inspectKm ?? null,
          entry.inspectMonths ?? null,
          entry.wearNew ?? null,
          entry.wearMin ?? null,
          entry.scope,
          car.id,
          entry.key,
        );
      }

      for (const key of NEWLY_TRACKABLE) {
        const entry = CATALOG_BY_KEY[key];
        if (!isApplicable(entry, car.fuel as FuelType, car.transmission as Transmission)) continue;
        await db.runAsync(
          'UPDATE parts SET tracked = 1 WHERE car_id = ? AND catalog_key = ?',
          car.id,
          key,
        );
      }
    }
  },
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  database = db;
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    const migration = MIGRATIONS[i];
    version = i + 1;
    // Номер версии пишется в той же транзакции: иначе обрыв между ними прогнал бы шаг
    // повторно, и `ALTER TABLE ADD COLUMN` навсегда упал бы на уже существующей колонке.
    await db.withTransactionAsync(async () => {
      if (typeof migration === 'string') await db.execAsync(migration);
      else await migration(db);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}

/** Полностью очищает базу — используется при импорте, который заменяет все данные. */
export async function wipeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM service_items; DELETE FROM service_records; DELETE FROM parts; DELETE FROM cars;',
    );
  });
}

/** Закрывает соединение — нужен в тестах и при полной переинициализации. */
export async function closeDatabase(): Promise<void> {
  if (!database) return;
  await database.closeAsync();
  database = null;
}

export function createId(): string {
  // Достаточно уникально для локальной базы одного устройства.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Сегодня по местному времени. `toISOString()` дал бы дату по UTC, и в первые часы
 * суток восточнее Гринвича сегодняшняя запись ТО считалась бы записью из будущего.
 */
export function todayIso(): string {
  return localIsoDate(new Date());
}
