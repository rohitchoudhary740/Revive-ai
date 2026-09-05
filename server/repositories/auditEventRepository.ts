import { dbQuery } from '../db';

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  event_type: string;
  case_id: string;
  details: string;
  actor: string;
  status: string;
}

export const AuditEventRepository = {
  async save(ae: AuditEventRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO audit_events (
        id, timestamp, event_type, case_id, details, actor, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ae.id,
        ae.timestamp,
        ae.event_type,
        ae.case_id,
        ae.details,
        ae.actor,
        ae.status
      ]
    );
  },

  async findAll(): Promise<AuditEventRecord[]> {
    return dbQuery.all<AuditEventRecord>(
      `SELECT * FROM audit_events ORDER BY timestamp DESC`
    );
  },

  async findByCaseId(caseId: string): Promise<AuditEventRecord[]> {
    return dbQuery.all<AuditEventRecord>(
      `SELECT * FROM audit_events WHERE case_id = ? ORDER BY timestamp DESC`,
      [caseId]
    );
  }
};
