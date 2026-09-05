import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_FILE = path.resolve(__dirname, '../../data.db');

// Ensure data directory exists if any
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Enable verbose mode for debugging
const sqlite = sqlite3.verbose();
export const db = new sqlite.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_FILE);
  }
});

// Promise-based helpers for database queries
export const dbQuery = {
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  },

  all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  },

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Initialize database schema
export async function initDb() {
  console.log('Initializing database schema...');

  // Create transactions table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      amount INTEGER,
      currency TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      status TEXT,
      failure_code TEXT,
      failure_reason TEXT,
      created_at TEXT
    )
  `);

  // Create recovery_cases table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS recovery_cases (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      status TEXT,
      current_stage TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id)
    )
  `);

  // Create ai_diagnoses table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS ai_diagnoses (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      root_cause TEXT,
      confidence REAL,
      recovery_probability REAL,
      recommended_action TEXT,
      reason TEXT,
      evidence TEXT,
      created_at TEXT,
      FOREIGN KEY (case_id) REFERENCES recovery_cases (id)
    )
  `);

  // Create policy_decisions table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS policy_decisions (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      approved INTEGER,
      status_text TEXT,
      checks TEXT,
      created_at TEXT,
      FOREIGN KEY (case_id) REFERENCES recovery_cases (id)
    )
  `);

  // Create recovery_actions table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS recovery_actions (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      channel TEXT,
      payment_link_id TEXT,
      payment_url TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (case_id) REFERENCES recovery_cases (id)
    )
  `);

  // Create audit_events table
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      event_type TEXT,
      case_id TEXT,
      details TEXT,
      actor TEXT,
      status TEXT
    )
  `);

  // Create webhooks_received table for idempotency check
  await dbQuery.exec(`
    CREATE TABLE IF NOT EXISTS webhooks_received (
      event_id TEXT PRIMARY KEY,
      processed_at TEXT
    )
  `);

  console.log('Database schema initialization completed.');
}
