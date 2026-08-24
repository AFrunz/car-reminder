import type { SQLiteBindValue } from 'expo-sqlite';
import { getDatabase, createId, todayIso } from './database';
import { CATALOG_BY_FREQUENCY, hasInterval, isApplicable } from '../data/catalog';
import type {
  Car,
  CategoryKey,
  FuelType,
  Part,
  ServiceItem,
  ServiceKind,
  ServiceRecord,
  ServiceRecordWithItems,
  Transmission,
} from '../domain/types';
import type { LastChange } from '../domain/resource';

/* ── Машины ─────────────────────────────────────────────────────────────── */

interface CarRow {
  id: string;
  make: string;
  model: string;
  year: number;
  fuel: string;
  transmission: string;
  mileage: number;
  service_interval_km: number;
  service_interval_months: number;
  created_at: string;
}

const toCar = (r: CarRow): Car => ({
  id: r.id,
  make: r.make,
  model: r.model,
  year: r.year,
  fuel: r.fuel as FuelType,
  transmission: r.transmission as Transmission,
  mileage: r.mileage,
  serviceIntervalKm: r.service_interval_km,
  serviceIntervalMonths: r.service_interval_months,
  createdAt: r.created_at,
});

export async function listCars(): Promise<Car[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CarRow>('SELECT * FROM cars ORDER BY created_at');
  return rows.map(toCar);
}

export async function getCar(id: string): Promise<Car | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CarRow>('SELECT * FROM cars WHERE id = ?', id);
  return row ? toCar(row) : null;
}

export interface NewCar {
  make: string;
  model: string;
  year: number;
  fuel: FuelType;
  transmission: Transmission;
  mileage: number;
  serviceIntervalKm?: number;
  serviceIntervalMonths?: number;
}

/**
 * Создаёт машину и наполняет её собственным каталогом деталей: позиции, неприменимые
 * к этому типу топлива или коробке, заводятся выключенными, а не пропускаются, —
 * иначе их нельзя было бы включить обратно, если пользователь поменяет характеристики.
 */
export async function createCar(input: NewCar): Promise<Car> {
  const db = await getDatabase();
  const id = createId();
  const createdAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO cars (id, make, model, year, fuel, transmission, mileage,
        service_interval_km, service_interval_months, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.make,
      input.model,
      input.year,
      input.fuel,
      input.transmission,
      input.mileage,
      input.serviceIntervalKm ?? 10_000,
      input.serviceIntervalMonths ?? 12,
      createdAt,
    );
    for (let i = 0; i < CATALOG_BY_FREQUENCY.length; i += 1) {
      const entry = CATALOG_BY_FREQUENCY[i];
      await db.runAsync(
        `INSERT INTO parts (id, car_id, catalog_key, name, category_key,
          interval_km, interval_months, tracked, custom, sort_order)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0, ?)`,
        createId(),
        id,
        entry.key,
        entry.category,
        entry.intervalKm,
        entry.intervalMonths,
        isApplicable(entry, input.fuel, input.transmission) && hasInterval(entry) ? 1 : 0,
        i,
      );
    }
  });
  return (await getCar(id))!;
}

export async function updateCar(id: string, patch: Partial<NewCar>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];
  const map: Record<string, string> = {
    make: 'make',
    model: 'model',
    year: 'year',
    fuel: 'fuel',
    transmission: 'transmission',
    mileage: 'mileage',
    serviceIntervalKm: 'service_interval_km',
    serviceIntervalMonths: 'service_interval_months',
  };
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, SQLiteBindValue | undefined>)[key];
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return;
  await db.runAsync(`UPDATE cars SET ${fields.join(', ')} WHERE id = ?`, ...values, id);
}

export async function deleteCar(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cars WHERE id = ?', id);
}

/* ── Детали ─────────────────────────────────────────────────────────────── */

interface PartRow {
  id: string;
  car_id: string;
  catalog_key: string | null;
  name: string | null;
  category_key: string;
  interval_km: number | null;
  interval_months: number | null;
  tracked: number;
  custom: number;
  sort_order: number;
}

const toPart = (r: PartRow): Part => ({
  id: r.id,
  carId: r.car_id,
  catalogKey: r.catalog_key,
  name: r.name,
  categoryKey: r.category_key as CategoryKey,
  intervalKm: r.interval_km,
  intervalMonths: r.interval_months,
  tracked: r.tracked === 1,
  custom: r.custom === 1,
  sortOrder: r.sort_order,
});

export async function listParts(carId: string, onlyTracked = false): Promise<Part[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PartRow>(
    `SELECT * FROM parts WHERE car_id = ?${onlyTracked ? ' AND tracked = 1' : ''}
     ORDER BY sort_order`,
    carId,
  );
  return rows.map(toPart);
}

export async function getPart(id: string): Promise<Part | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PartRow>('SELECT * FROM parts WHERE id = ?', id);
  return row ? toPart(row) : null;
}

export interface NewPart {
  carId: string;
  name: string;
  categoryKey: CategoryKey;
  intervalKm: number | null;
  intervalMonths: number | null;
}

export async function createCustomPart(input: NewPart): Promise<Part> {
  const db = await getDatabase();
  const id = createId();
  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM parts WHERE car_id = ?',
    input.carId,
  );
  await db.runAsync(
    `INSERT INTO parts (id, car_id, catalog_key, name, category_key,
      interval_km, interval_months, tracked, custom, sort_order)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?)`,
    id,
    input.carId,
    input.name,
    input.categoryKey,
    input.intervalKm,
    input.intervalMonths,
    hasInterval(input) ? 1 : 0,
    row?.next ?? 0,
  );
  return (await getPart(id))!;
}

export async function updatePart(
  id: string,
  patch: Partial<Pick<Part, 'name' | 'categoryKey' | 'intervalKm' | 'intervalMonths' | 'tracked'>>,
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.categoryKey !== undefined) {
    fields.push('category_key = ?');
    values.push(patch.categoryKey);
  }
  if (patch.intervalKm !== undefined) {
    fields.push('interval_km = ?');
    values.push(patch.intervalKm);
  }
  if (patch.intervalMonths !== undefined) {
    fields.push('interval_months = ?');
    values.push(patch.intervalMonths);
  }
  if (patch.tracked !== undefined) {
    fields.push('tracked = ?');
    values.push(patch.tracked ? 1 : 0);
  }
  if (fields.length === 0) return;
  await db.runAsync(`UPDATE parts SET ${fields.join(', ')} WHERE id = ?`, ...values, id);
}

/**
 * Своя деталь удаляется физически только если она ни разу не встречалась в истории;
 * иначе остаётся скрытой, чтобы записи ТО не потеряли позицию.
 */
export async function deleteOrHidePart(id: string): Promise<'deleted' | 'hidden'> {
  const db = await getDatabase();
  const used = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM service_items WHERE part_id = ?',
    id,
  );
  const part = await getPart(id);
  if (part?.custom && (used?.count ?? 0) === 0) {
    await db.runAsync('DELETE FROM parts WHERE id = ?', id);
    return 'deleted';
  }
  await updatePart(id, { tracked: false });
  return 'hidden';
}

/** Последняя замена детали — исключительно по записям ТО. */
export async function lastChangeForPart(partId: string): Promise<LastChange | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mileage: number; date: string }>(
    `SELECT r.mileage AS mileage, r.date AS date
     FROM service_items i JOIN service_records r ON r.id = i.record_id
     WHERE i.part_id = ? ORDER BY r.mileage DESC, r.date DESC LIMIT 1`,
    partId,
  );
  return row ?? null;
}

export async function lastChangesForCar(carId: string): Promise<Record<string, LastChange>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ part_id: string; mileage: number; date: string }>(
    `SELECT i.part_id AS part_id, MAX(r.mileage) AS mileage, r.date AS date
     FROM service_items i JOIN service_records r ON r.id = i.record_id
     WHERE r.car_id = ? AND i.part_id IS NOT NULL
     GROUP BY i.part_id`,
    carId,
  );
  const result: Record<string, LastChange> = {};
  for (const row of rows) result[row.part_id] = { mileage: row.mileage, date: row.date };
  return result;
}

/** История замен конкретной детали, от свежих к старым. */
export async function historyForPart(partId: string): Promise<
  Array<{ recordId: string; mileage: number; date: string; cost: number | null; note: string | null }>
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT r.id AS recordId, r.mileage AS mileage, r.date AS date, i.cost AS cost, i.note AS note
     FROM service_items i JOIN service_records r ON r.id = i.record_id
     WHERE i.part_id = ? ORDER BY r.mileage DESC`,
    partId,
  );
}

/* ── Записи ТО ──────────────────────────────────────────────────────────── */

interface RecordRow {
  id: string;
  car_id: string;
  date: string;
  mileage: number;
  kind: string;
  total_cost: number | null;
  created_at: string;
}

const toRecord = (r: RecordRow): ServiceRecord => ({
  id: r.id,
  carId: r.car_id,
  date: r.date,
  mileage: r.mileage,
  kind: r.kind as ServiceKind,
  totalCost: r.total_cost,
  createdAt: r.created_at,
});

interface ItemRow {
  id: string;
  record_id: string;
  type: string;
  part_id: string | null;
  name: string | null;
  category_key: string;
  cost: number | null;
  note: string | null;
}

const toItem = (r: ItemRow): ServiceItem => ({
  id: r.id,
  recordId: r.record_id,
  type: r.type as ServiceItem['type'],
  partId: r.part_id,
  name: r.name,
  categoryKey: r.category_key as CategoryKey,
  cost: r.cost,
  note: r.note,
});

export async function listRecords(carId: string): Promise<ServiceRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecordRow>(
    'SELECT * FROM service_records WHERE car_id = ? ORDER BY mileage DESC, date DESC',
    carId,
  );
  return rows.map(toRecord);
}

export async function listRecordsWithItems(carId: string): Promise<ServiceRecordWithItems[]> {
  const db = await getDatabase();
  const records = await listRecords(carId);
  if (records.length === 0) return [];
  const items = await db.getAllAsync<ItemRow>(
    `SELECT i.* FROM service_items i JOIN service_records r ON r.id = i.record_id
     WHERE r.car_id = ?`,
    carId,
  );
  const byRecord = new Map<string, ServiceItem[]>();
  for (const row of items) {
    const item = toItem(row);
    const list = byRecord.get(item.recordId);
    if (list) list.push(item);
    else byRecord.set(item.recordId, [item]);
  }
  return records.map((r) => ({ ...r, items: byRecord.get(r.id) ?? [] }));
}

export async function getRecord(id: string): Promise<ServiceRecordWithItems | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RecordRow>('SELECT * FROM service_records WHERE id = ?', id);
  if (!row) return null;
  const items = await db.getAllAsync<ItemRow>(
    'SELECT * FROM service_items WHERE record_id = ?',
    id,
  );
  return { ...toRecord(row), items: items.map(toItem) };
}

export interface NewServiceItem {
  type: ServiceItem['type'];
  partId: string | null;
  name: string | null;
  categoryKey: CategoryKey;
  cost: number | null;
  /** Свободная пометка: модель, артикул, что угодно. */
  note: string | null;
}

export interface NewServiceRecord {
  carId: string;
  date: string;
  mileage: number;
  kind: ServiceKind;
  totalCost: number | null;
  items: NewServiceItem[];
}

export async function saveRecord(input: NewServiceRecord, id?: string): Promise<string> {
  const db = await getDatabase();
  const recordId = id ?? createId();
  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync(
        'UPDATE service_records SET date = ?, mileage = ?, kind = ?, total_cost = ? WHERE id = ?',
        input.date,
        input.mileage,
        input.kind,
        input.totalCost,
        id,
      );
      await db.runAsync('DELETE FROM service_items WHERE record_id = ?', id);
    } else {
      await db.runAsync(
        `INSERT INTO service_records (id, car_id, date, mileage, kind, total_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        input.carId,
        input.date,
        input.mileage,
        input.kind,
        input.totalCost,
        new Date().toISOString(),
      );
    }
    for (const item of input.items) {
      await db.runAsync(
        `INSERT INTO service_items (id, record_id, type, part_id, name, category_key, cost, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        createId(),
        recordId,
        item.type,
        item.partId,
        item.name,
        item.categoryKey,
        item.cost,
        item.note,
      );
    }
  });
  return recordId;
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM service_records WHERE id = ?', id);
}

/** Последнее регулярное ТО — от него отсчитывается «Следующее ТО». */
export async function lastScheduledService(carId: string): Promise<LastChange | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mileage: number; date: string }>(
    `SELECT mileage, date FROM service_records
     WHERE car_id = ? AND kind = 'scheduled' ORDER BY mileage DESC, date DESC LIMIT 1`,
    carId,
  );
  return row ?? null;
}

/** Названия ранее введённых услуг — подсказки при вводе новой. */
export async function knownServiceNames(carId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT DISTINCT i.name AS name FROM service_items i
     JOIN service_records r ON r.id = i.record_id
     WHERE r.car_id = ? AND i.type = 'service' AND i.name IS NOT NULL
     ORDER BY i.name`,
    carId,
  );
  return rows.map((r) => r.name);
}

/* ── Настройки ──────────────────────────────────────────────────────────── */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    key,
    value,
    value,
  );
}

export { todayIso };
