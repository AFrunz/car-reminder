import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase, wipeDatabase } from './database';

/**
 * Перенос данных между устройствами — единственный способ, раз бэкенда нет.
 * Формат намеренно плоский: те же таблицы, что в базе, чтобы импорт не зависел
 * от текущей формы доменных типов и переживал их рефакторинг.
 */

export const BACKUP_SCHEMA_VERSION = 1;

const TABLES = ['cars', 'parts', 'service_records', 'service_items', 'settings'] as const;
type TableName = (typeof TABLES)[number];

export interface BackupFile {
  app: 'car-reminder';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, Record<string, unknown>[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const db = await getDatabase();
  const tables = {} as Record<TableName, Record<string, unknown>[]>;
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  return {
    app: 'car-reminder',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Пишет бэкап во временный файл и отдаёт его системному «Поделиться». */
export async function exportBackup(): Promise<'shared' | 'unavailable'> {
  const backup = await buildBackup();
  const stamp = backup.exportedAt.slice(0, 10);
  const file = new File(Paths.cache, `car-reminder-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Car Reminder',
    UTI: 'public.json',
  });
  return 'shared';
}

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'invalid'; reason: 'not-json' | 'wrong-app' | 'unsupported-version' }
  | { status: 'imported'; cars: number; records: number };

function isBackup(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BackupFile>;
  return candidate.app === 'car-reminder' && typeof candidate.tables === 'object';
}

/**
 * Импорт полностью заменяет текущие данные — слияние двух историй одной машины
 * не имеет однозначного разрешения конфликтов по пробегу, поэтому его не делаем.
 * Вызывающий код обязан спросить подтверждение до вызова.
 */
export async function importBackup(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    return { status: 'invalid', reason: 'not-json' };
  }

  if (!isBackup(parsed)) return { status: 'invalid', reason: 'wrong-app' };
  if (parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { status: 'invalid', reason: 'unsupported-version' };
  }

  await wipeDatabase();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const table of TABLES) {
      const rows = parsed.tables[table] ?? [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          ...columns.map((c) => row[c] as string | number | null),
        );
      }
    }
  });

  return {
    status: 'imported',
    cars: parsed.tables.cars?.length ?? 0,
    records: parsed.tables.service_records?.length ?? 0,
  };
}
