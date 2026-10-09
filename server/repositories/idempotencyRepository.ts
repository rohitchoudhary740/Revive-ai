import { dbQuery } from '../db';

export const EXECUTION_MODES = ['DEMO', 'SIMULATED', 'TEST_MODE', 'LIVE'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export interface IdempotencyRecord {
  key: string;
  case_id: string;
  action_type: string;
  status: 'in_progress' | 'completed' | 'failed';
  request_payload?: string | null;
  response_payload?: string | null;
  execution_mode: ExecutionMode;
  created_at: string;
  completed_at?: string | null;
}

export const IdempotencyRepository = {
  async initTable(): Promise<void> {
    await dbQuery.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_records (
        key TEXT PRIMARY KEY,
        case_id TEXT,
        action_type TEXT,
        status TEXT,
        request_payload TEXT,
        response_payload TEXT,
        execution_mode TEXT,
        created_at TEXT,
        completed_at TEXT
      )
    `);
  },

  async findByKey(key: string): Promise<IdempotencyRecord | undefined> {
    await this.initTable();
    return dbQuery.get<IdempotencyRecord>(
      `SELECT * FROM idempotency_records WHERE key = ?`,
      [key]
    );
  },

  async findActiveByCaseId(caseId: string): Promise<IdempotencyRecord[]> {
    await this.initTable();
    return dbQuery.all<IdempotencyRecord>(
      `SELECT * FROM idempotency_records WHERE case_id = ? AND status = 'in_progress'`,
      [caseId]
    );
  },

  async save(record: IdempotencyRecord): Promise<void> {
    await this.initTable();
    await dbQuery.run(
      `INSERT OR REPLACE INTO idempotency_records (
        key, case_id, action_type, status, request_payload, response_payload, execution_mode, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.key,
        record.case_id,
        record.action_type,
        record.status,
        record.request_payload ?? null,
        record.response_payload ?? null,
        record.execution_mode,
        record.created_at,
        record.completed_at ?? null
      ]
    );
  },

  async markCompleted(key: string, responsePayload?: any): Promise<void> {
    await this.initTable();
    const payloadStr = responsePayload ? JSON.stringify(responsePayload) : null;
    const now = new Date().toISOString();
    await dbQuery.run(
      `UPDATE idempotency_records SET status = 'completed', response_payload = ?, completed_at = ? WHERE key = ?`,
      [payloadStr, now, key]
    );
  },

  async markFailed(key: string, errorReason?: string): Promise<void> {
    await this.initTable();
    const payloadStr = errorReason ? JSON.stringify({ error: errorReason }) : null;
    const now = new Date().toISOString();
    await dbQuery.run(
      `UPDATE idempotency_records SET status = 'failed', response_payload = ?, completed_at = ? WHERE key = ?`,
      [payloadStr, now, key]
    );
  },

  async delete(key: string): Promise<void> {
    await this.initTable();
    await dbQuery.run(`DELETE FROM idempotency_records WHERE key = ?`, [key]);
  },

  async deleteByCaseId(caseId: string): Promise<void> {
    await this.initTable();
    await dbQuery.run(`DELETE FROM idempotency_records WHERE case_id = ?`, [caseId]);
  },

  async clear(): Promise<void> {
    await this.initTable();
    await dbQuery.run(`DELETE FROM idempotency_records`);
  }
};
