import { dbQuery } from '../db';

export interface AiDiagnosisRecord {
  id: string;
  case_id: string;
  root_cause: string;
  confidence: number;
  recovery_probability: number;
  recommended_action: string;
  reason: string;
  evidence: string; // JSON serialized string array
  created_at: string;
}

export const AiDiagnosisRepository = {
  async save(ad: AiDiagnosisRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO ai_diagnoses (
        id, case_id, root_cause, confidence, recovery_probability, recommended_action, reason, evidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ad.id,
        ad.case_id,
        ad.root_cause,
        ad.confidence,
        ad.recovery_probability,
        ad.recommended_action,
        ad.reason,
        ad.evidence,
        ad.created_at
      ]
    );
  },

  async findByCaseId(caseId: string): Promise<AiDiagnosisRecord | undefined> {
    return dbQuery.get<AiDiagnosisRecord>(
      `SELECT * FROM ai_diagnoses WHERE case_id = ?`,
      [caseId]
    );
  }
};
