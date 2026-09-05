import { dbQuery } from '../db';

export interface PolicyDecisionRecord {
  id: string;
  case_id: string;
  approved: number; // 0 or 1
  status_text: string;
  checks: string; // JSON serialized string checks
  created_at: string;
}

export const PolicyDecisionRepository = {
  async save(pd: PolicyDecisionRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO policy_decisions (
        id, case_id, approved, status_text, checks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pd.id,
        pd.case_id,
        pd.approved,
        pd.status_text,
        pd.checks,
        pd.created_at
      ]
    );
  },

  async findByCaseId(caseId: string): Promise<PolicyDecisionRecord | undefined> {
    return dbQuery.get<PolicyDecisionRecord>(
      `SELECT * FROM policy_decisions WHERE case_id = ?`,
      [caseId]
    );
  }
};
