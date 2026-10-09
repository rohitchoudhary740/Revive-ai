import { dbQuery } from '../db';
import { RecoveryStrategyId } from '../services/strategyRegistry';

export interface StrategyIntelligenceRecord {
  id: string;
  case_id: string;
  diagnosis: string;
  confidence: number;
  recovery_probability: number;
  recommended_strategy: RecoveryStrategyId;
  reasoning: string;
  evidence: string; // JSON array string
  alternative_strategy: RecoveryStrategyId | null;
  why_not_alternative: string;
  risk_flags: string; // JSON array string
  validation_passed: number; // 1 or 0
  is_fallback: number; // 1 or 0
  raw_output?: string | null;
  created_at: string;
}

export const StrategyIntelligenceRepository = {
  async save(record: StrategyIntelligenceRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO ai_strategy_intelligence (
        id, case_id, diagnosis, confidence, recovery_probability,
        recommended_strategy, reasoning, evidence, alternative_strategy,
        why_not_alternative, risk_flags, validation_passed, is_fallback,
        raw_output, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.case_id,
        record.diagnosis,
        record.confidence,
        record.recovery_probability,
        record.recommended_strategy,
        record.reasoning,
        record.evidence,
        record.alternative_strategy || null,
        record.why_not_alternative,
        record.risk_flags,
        record.validation_passed,
        record.is_fallback,
        record.raw_output || null,
        record.created_at
      ]
    );
  },

  async findByCaseId(caseId: string): Promise<StrategyIntelligenceRecord | undefined> {
    return dbQuery.get<StrategyIntelligenceRecord>(
      `SELECT * FROM ai_strategy_intelligence WHERE case_id = ? ORDER BY created_at DESC LIMIT 1`,
      [caseId]
    );
  },

  async findAllByCaseId(caseId: string): Promise<StrategyIntelligenceRecord[]> {
    return dbQuery.all<StrategyIntelligenceRecord>(
      `SELECT * FROM ai_strategy_intelligence WHERE case_id = ? ORDER BY created_at ASC`,
      [caseId]
    );
  },

  async clearByCaseId(caseId: string): Promise<void> {
    await dbQuery.run(`DELETE FROM ai_strategy_intelligence WHERE case_id = ?`, [caseId]);
  }
};
