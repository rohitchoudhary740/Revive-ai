import { dbQuery } from '../db';

export interface RecoveryActionRecord {
  id: string;
  case_id: string;
  channel: string;
  payment_link_id?: string;
  payment_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const RecoveryActionRepository = {
  async save(ra: RecoveryActionRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO recovery_actions (
        id, case_id, channel, payment_link_id, payment_url, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ra.id,
        ra.case_id,
        ra.channel,
        ra.payment_link_id || null,
        ra.payment_url || null,
        ra.status,
        ra.created_at,
        ra.updated_at
      ]
    );
  },

  async findByCaseId(caseId: string): Promise<RecoveryActionRecord | undefined> {
    return dbQuery.get<RecoveryActionRecord>(
      `SELECT * FROM recovery_actions WHERE case_id = ?`,
      [caseId]
    );
  },

  async findByPaymentLinkId(linkId: string): Promise<RecoveryActionRecord | undefined> {
    return dbQuery.get<RecoveryActionRecord>(
      `SELECT * FROM recovery_actions WHERE payment_link_id = ?`,
      [linkId]
    );
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const now = new Date().toISOString();
    await dbQuery.run(
      `UPDATE recovery_actions SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, id]
    );
  }
};
