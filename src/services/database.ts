import * as SQLite from 'expo-sqlite';
import { OfflineTelemetry, OfflineHydration, OfflineSleep } from '../types';

const DATABASE_NAME = 'aquaayur.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Open or retrieve the database instance.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

/**
 * Initialize local tables for offline cache.
 */
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Enable WAL mode for performance (optional, ignore if fails on locked database)
    try {
      await db.execAsync('PRAGMA journal_mode = WAL;');
    } catch (e) {
      console.warn('[Database] WAL mode setting bypassed:', e);
    }

    // Telemetry cache table (supports steps and activity type variables)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_telemetry (
        id TEXT PRIMARY KEY NOT NULL,
        timestamp TEXT NOT NULL,
        heart_rate INTEGER NOT NULL,
        skin_temperature REAL NOT NULL,
        steps INTEGER NOT NULL,
        activity TEXT NOT NULL
      );
    `);

    // Dynamic schema migration: add steps and activity columns to offline_telemetry if table existed previously without them
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(offline_telemetry);');
    const columns = tableInfo.map(c => c.name);
    if (!columns.includes('steps')) {
      await db.execAsync('ALTER TABLE offline_telemetry ADD COLUMN steps INTEGER NOT NULL DEFAULT 0;');
      console.log("[Database] Schema Migration: Added 'steps' column to 'offline_telemetry'.");
    }
    if (!columns.includes('activity')) {
      await db.execAsync("ALTER TABLE offline_telemetry ADD COLUMN activity TEXT NOT NULL DEFAULT 'sedentary';");
      console.log("[Database] Schema Migration: Added 'activity' column to 'offline_telemetry'.");
    }

    // Hydration cache table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_hydration (
        id TEXT PRIMARY KEY NOT NULL,
        timestamp TEXT NOT NULL,
        amount_ml INTEGER NOT NULL,
        source TEXT NOT NULL
      );
    `);

    // Sleep cache table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_sleep (
        id TEXT PRIMARY KEY NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        sleep_score INTEGER NOT NULL
      );
    `);

    // Create query optimization indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_offline_telemetry_time ON offline_telemetry (timestamp);
      CREATE INDEX IF NOT EXISTS idx_offline_hydration_time ON offline_hydration (timestamp);
      CREATE INDEX IF NOT EXISTS idx_offline_sleep_time ON offline_sleep (start_time);
    `);

    console.log('[Database] Local SQLite tables and indexes initialized successfully.');
  } catch (error) {
    console.error('[Database] Failed to initialize local database:', error);
    throw error;
  }
}

/**
 * Insert a telemetry log into the local database.
 */
export async function insertLocalTelemetry(data: Omit<OfflineTelemetry, 'id'>): Promise<string> {
  const db = await getDatabase();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  await db.runAsync(
    `INSERT INTO offline_telemetry (id, timestamp, heart_rate, skin_temperature, steps, activity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.timestamp, data.heart_rate, data.skin_temperature, data.steps, data.activity]
  );
  return id;
}

/**
 * Insert a batch of telemetry logs into the local SQLite database inside a single transaction.
 */
export async function batchInsertLocalTelemetry(dataArray: Omit<OfflineTelemetry, 'id'>[]): Promise<void> {
  if (dataArray.length === 0) return;
  const db = await getDatabase();
  
  try {
    await db.withTransactionAsync(async () => {
      for (const data of dataArray) {
        const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.runAsync(
          `INSERT INTO offline_telemetry (id, timestamp, heart_rate, skin_temperature, steps, activity)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, data.timestamp, data.heart_rate, data.skin_temperature, data.steps, data.activity]
        );
      }
    });
  } catch (error) {
    console.error('[Database] Batch telemetry insertion failed:', error);
    throw error;
  }
}

/**
 * Retrieve all pending telemetry logs.
 */
export async function getPendingTelemetry(): Promise<OfflineTelemetry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OfflineTelemetry>('SELECT * FROM offline_telemetry ORDER BY timestamp ASC');
  return rows;
}

/**
 * Clear specific synced telemetry records.
 */
export async function deleteLocalTelemetry(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM offline_telemetry WHERE id IN (${placeholders})`, ids);
}

/**
 * Insert a hydration log into the local database.
 */
export async function insertLocalHydration(amountMl: number, source: string): Promise<string> {
  const db = await getDatabase();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO offline_hydration (id, timestamp, amount_ml, source) VALUES (?, ?, ?, ?)',
    [id, timestamp, amountMl, source]
  );
  return id;
}

/**
 * Retrieve all pending hydration logs.
 */
export async function getPendingHydration(): Promise<OfflineHydration[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OfflineHydration>('SELECT * FROM offline_hydration ORDER BY timestamp ASC');
  return rows;
}

/**
 * Clear specific synced hydration records.
 */
export async function deleteLocalHydration(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM offline_hydration WHERE id IN (${placeholders})`, ids);
}

/**
 * Insert a sleep log into the local database.
 */
export async function insertLocalSleep(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  sleepScore: number
): Promise<string> {
  const db = await getDatabase();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  await db.runAsync(
    'INSERT INTO offline_sleep (id, start_time, end_time, duration_minutes, sleep_score) VALUES (?, ?, ?, ?, ?)',
    [id, startTime, endTime, durationMinutes, sleepScore]
  );
  return id;
}

/**
 * Retrieve all pending sleep logs.
 */
export async function getPendingSleep(): Promise<OfflineSleep[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OfflineSleep>('SELECT * FROM offline_sleep ORDER BY start_time ASC');
  return rows;
}

/**
 * Clear specific synced sleep records.
 */
export async function deleteLocalSleep(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM offline_sleep WHERE id IN (${placeholders})`, ids);
}
