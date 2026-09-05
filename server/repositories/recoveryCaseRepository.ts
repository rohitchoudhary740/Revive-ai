import { dbQuery } from '../db';

export interface RecoveryCaseRecord {
  id: string;
  transaction_id: string;
  status: string;
  current_stage: string;
  created_at: string;
  updated_at: string;
}

export const RecoveryCaseRepository = {
  async save(rc: RecoveryCaseRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO recovery_cases (
        id, transaction_id, status, current_stage, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        rc.id,
        rc.transaction_id,
        rc.status,
        rc.current_stage,
        rc.created_at,
        rc.updated_at
      ]
    );
  },

  async findById(id: string): Promise<RecoveryCaseRecord | undefined> {
    return dbQuery.get<RecoveryCaseRecord>(
      `SELECT * FROM recovery_cases WHERE id = ?`,
      [id]
    );
  },

  async findByTransactionId(transactionId: string): Promise<RecoveryCaseRecord | undefined> {
    return dbQuery.get<RecoveryCaseRecord>(
      `SELECT * FROM recovery_cases WHERE transaction_id = ?`,
      [transactionId]
    );
  },

  async findAll(): Promise<RecoveryCaseRecord[]> {
    return dbQuery.all<RecoveryCaseRecord>(
      `SELECT * FROM recovery_cases ORDER BY created_at DESC`
    );
  },

  async updateStatus(id: string, status: string, currentStage: string): Promise<void> {
    const now = new Date().toISOString();
    await dbQuery.run(
      `UPDATE recovery_cases SET status = ?, current_stage = ?, updated_at = ? WHERE id = ?`,
      [status, currentStage, now, id]
    );
  }
};
