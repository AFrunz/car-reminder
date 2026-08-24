import * as SQLite from 'expo-sqlite';
import { CATALOG_BY_FREQUENCY, isApplicable } from '../data/catalog';
import type { FuelType, Transmission } from '../domain/types';

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
    const cars = await db.getAllAsync<{ id: string; fuel: string; transmission: string }>(
      'SELECT id, fuel, transmission FROM cars',
    );
    for (const car of cars) {
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
        } else {
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
            isApplicable(entry, car.fuel as FuelType, car.transmission as Transmission) ? 1 : 0,
            i,
          );
        }
      }
      // Свои детали остаются в конце списка, сохраняя относительный порядок.
      await db.runAsync(
        'UPDATE parts SET sort_order = sort_order + ? WHERE car_id = ? AND catalog_key IS NULL',
        CATALOG_BY_FREQUENCY.length,
        car.id,
      );
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
    await db.withTransactionAsync(async () => {
      if (typeof migration === 'string') await db.execAsync(migration);
      else await migration(db);
    });
    version = i + 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
