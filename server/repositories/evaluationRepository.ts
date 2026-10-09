import { dbQuery } from '../db';

export interface EvaluationRunRecord {
  id: string;
  created_at: string;
  seed: number;
  batch_size: number;
  guardrails_snapshot: string;
  baseline_metrics: string;
  reviveai_metrics: string;
  lift_metrics: string;
  summary_notes?: string;
}

export interface EvaluationCaseRecord {
  id: string;
  run_id: string;
  payment_id: string;
  customer_name: string;
  customer_email: string;
  customer_tier: string;
  amount: number;
  failure_code: string;
  failure_type: string;
  retry_count: number;
  ground_truth_prob: number;
  reviveai_prob: number;
  reviveai_action: string;
  reviveai_policy_status: string;
  reviveai_is_approved: number;
  reviveai_is_human_review: number;
  reviveai_is_stopped: number;
  reviveai_intervened: number;
  reviveai_recovered: number;
  reviveai_recovered_revenue: number;
  baseline_intervened: number;
  baseline_recovered: number;
  baseline_recovered_revenue: number;
  is_synthetic: number;
  created_at: string;
}

export const EvaluationRepository = {
  async saveRun(run: EvaluationRunRecord): Promise<void> {
    await dbQuery.run(
      `INSERT OR REPLACE INTO evaluation_runs (
        id, created_at, seed, batch_size, guardrails_snapshot,
        baseline_metrics, reviveai_metrics, lift_metrics, summary_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.created_at,
        run.seed,
        run.batch_size,
        run.guardrails_snapshot,
        run.baseline_metrics,
        run.reviveai_metrics,
        run.lift_metrics,
        run.summary_notes || ''
      ]
    );
  },

  async saveCases(cases: EvaluationCaseRecord[]): Promise<void> {
    for (const c of cases) {
      await dbQuery.run(
        `INSERT OR REPLACE INTO evaluation_cases (
          id, run_id, payment_id, customer_name, customer_email, customer_tier,
          amount, failure_code, failure_type, retry_count,
          ground_truth_prob, reviveai_prob, reviveai_action, reviveai_policy_status,
          reviveai_is_approved, reviveai_is_human_review, reviveai_is_stopped,
          reviveai_intervened, reviveai_recovered, reviveai_recovered_revenue,
          baseline_intervened, baseline_recovered, baseline_recovered_revenue,
          is_synthetic, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.run_id,
          c.payment_id,
          c.customer_name,
          c.customer_email,
          c.customer_tier,
          c.amount,
          c.failure_code,
          c.failure_type,
          c.retry_count,
          c.ground_truth_prob,
          c.reviveai_prob,
          c.reviveai_action,
          c.reviveai_policy_status,
          c.reviveai_is_approved,
          c.reviveai_is_human_review,
          c.reviveai_is_stopped,
          c.reviveai_intervened,
          c.reviveai_recovered,
          c.reviveai_recovered_revenue,
          c.baseline_intervened,
          c.baseline_recovered,
          c.baseline_recovered_revenue,
          c.is_synthetic ?? 1,
          c.created_at
        ]
      );
    }
  },

  async findLatestRun(): Promise<EvaluationRunRecord | undefined> {
    return dbQuery.get<EvaluationRunRecord>(
      `SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT 1`
    );
  },

  async findRunById(id: string): Promise<EvaluationRunRecord | undefined> {
    return dbQuery.get<EvaluationRunRecord>(
      `SELECT * FROM evaluation_runs WHERE id = ?`,
      [id]
    );
  },

  async findAllRuns(limit = 10): Promise<EvaluationRunRecord[]> {
    return dbQuery.all<EvaluationRunRecord>(
      `SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  },

  async findCasesByRunId(runId: string, limit = 100, offset = 0): Promise<EvaluationCaseRecord[]> {
    return dbQuery.all<EvaluationCaseRecord>(
      `SELECT * FROM evaluation_cases WHERE run_id = ? ORDER BY id ASC LIMIT ? OFFSET ?`,
      [runId, limit, offset]
    );
  }
};
