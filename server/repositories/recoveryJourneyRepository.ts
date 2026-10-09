import { dbQuery } from '../db';
import { RecoveryStrategyId } from '../services/strategyRegistry';

export interface RecoveryJourneyStepRecord {
  id: string;
  case_id: string;
  attempt_number: number;
  strategy_id: RecoveryStrategyId;
  strategy_name: string;
  reasoning: string;
  policy_approved: number; // 1 or 0
  policy_checks: string; // JSON string
  policy_status_text: string;
  action_status: 'pending' | 'executed' | 'failed' | 'skipped';
  action_payload: string; // JSON string
  outcome: 'success' | 'failure' | 'in_progress' | 'pending_verification';
  failure_reason?: string | null;
  next_action?: string | null;
  created_at: string;
  updated_at: string;
}

export const RecoveryJourneyRepository = {
  async saveStep(step: RecoveryJourneyStepRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO recovery_journey_steps (
        id, case_id, attempt_number, strategy_id, strategy_name, reasoning,
        policy_approved, policy_checks, policy_status_text, action_status,
        action_payload, outcome, failure_reason, next_action, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        step.id,
        step.case_id,
        step.attempt_number,
        step.strategy_id,
        step.strategy_name,
        step.reasoning,
        step.policy_approved,
        step.policy_checks,
        step.policy_status_text,
        step.action_status,
        step.action_payload,
        step.outcome,
        step.failure_reason || null,
        step.next_action || null,
        step.created_at,
        step.updated_at
      ]
    );
  },

  async findByCaseId(caseId: string): Promise<RecoveryJourneyStepRecord[]> {
    return dbQuery.all<RecoveryJourneyStepRecord>(
      `SELECT * FROM recovery_journey_steps WHERE case_id = ? ORDER BY attempt_number ASC`,
      [caseId]
    );
  },

  async findStep(id: string): Promise<RecoveryJourneyStepRecord | undefined> {
    return dbQuery.get<RecoveryJourneyStepRecord>(
      `SELECT * FROM recovery_journey_steps WHERE id = ?`,
      [id]
    );
  },

  async getLatestStep(caseId: string): Promise<RecoveryJourneyStepRecord | undefined> {
    return dbQuery.get<RecoveryJourneyStepRecord>(
      `SELECT * FROM recovery_journey_steps WHERE case_id = ? ORDER BY attempt_number DESC LIMIT 1`,
      [caseId]
    );
  },

  async updateStepOutcome(
    id: string,
    outcome: 'success' | 'failure' | 'in_progress' | 'pending_verification',
    failureReason?: string | null,
    nextAction?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    await dbQuery.run(
      `UPDATE recovery_journey_steps
       SET outcome = ?, failure_reason = ?, next_action = ?, updated_at = ?
       WHERE id = ?`,
      [outcome, failureReason || null, nextAction || null, now, id]
    );
  },

  async countAttemptsByStrategy(caseId: string, strategyId: RecoveryStrategyId): Promise<number> {
    const row = await dbQuery.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM recovery_journey_steps WHERE case_id = ? AND strategy_id = ?`,
      [caseId, strategyId]
    );
    return row?.count ?? 0;
  },

  async clearByCaseId(caseId: string): Promise<void> {
    await dbQuery.run(`DELETE FROM recovery_journey_steps WHERE case_id = ?`, [caseId]);
  }
};
