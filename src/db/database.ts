import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'car-reminder.db';

let database: SQLite.SQLiteDatabase | null = null;

/**
 * Каждая миграция — шаг от предыдущей версии схемы к следующей. Номер последней
 * применённой хранится в `PRAGMA user_version`, поэтому обновление приложения
 * догоняет схему, не трогая пользовательские данные.
 */
const MIGRATIONS: string[] = [
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
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[i]);
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
