// ─── Recovery Guardrails (merchant-configurable policy boundaries) ──────────
// These are the SAME boundaries the deterministic policy engine already
// enforces — previously hardcoded, now exposed so a merchant can tune them.
// State is held in-memory for the server session (no database table / schema
// change). It resets to defaults when the server restarts; the UI states this.

export type AgentMode = 'auto_recover' | 'review_first' | 'manual_only';

export interface GuardrailConfig {
  /** Transactions above this INR amount are treated as high-value. */
  maxAutoRecoveryAmount: number;
  /** Minimum acceptable recovery probability, 0..1. */
  minRecoveryProbability: number;
  /** Automated retries allowed before recovery is halted. */
  maxAutomatedRetries: number;
  /** When true, high-value cases are held for human approval (default). */
  highValueRequiresApproval: boolean;
  /** When true, below-threshold probability stops recovery (default). */
  lowConfidenceStops: boolean;
  /** Global agent autonomy level. */
  agentMode: AgentMode;
}

// Defaults reproduce the EXISTING hardcoded policy behavior exactly.
export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxAutoRecoveryAmount: 25000,
  minRecoveryProbability: 0.30,
  maxAutomatedRetries: 3,
  highValueRequiresApproval: true,
  lowConfidenceStops: true,
  agentMode: 'auto_recover',
};

let current: GuardrailConfig = { ...DEFAULT_GUARDRAILS };

export function getGuardrailConfig(): GuardrailConfig {
  return { ...current };
}

// Validates + clamps an incoming partial patch, then applies it. Unknown or
// malformed fields are ignored so a bad request can never corrupt the config.
export function updateGuardrailConfig(patch: Partial<GuardrailConfig>): GuardrailConfig {
  const next: GuardrailConfig = { ...current };

  if (typeof patch.maxAutoRecoveryAmount === 'number' && isFinite(patch.maxAutoRecoveryAmount)) {
    next.maxAutoRecoveryAmount = Math.max(0, Math.round(patch.maxAutoRecoveryAmount));
  }
  if (typeof patch.minRecoveryProbability === 'number' && isFinite(patch.minRecoveryProbability)) {
    // Accept either a 0..1 fraction or a 0..100 percentage; normalize to 0..1.
    const p = patch.minRecoveryProbability > 1 ? patch.minRecoveryProbability / 100 : patch.minRecoveryProbability;
    next.minRecoveryProbability = Math.min(1, Math.max(0, p));
  }
  if (typeof patch.maxAutomatedRetries === 'number' && isFinite(patch.maxAutomatedRetries)) {
    next.maxAutomatedRetries = Math.min(10, Math.max(0, Math.round(patch.maxAutomatedRetries)));
  }
  if (typeof patch.highValueRequiresApproval === 'boolean') {
    next.highValueRequiresApproval = patch.highValueRequiresApproval;
  }
  if (typeof patch.lowConfidenceStops === 'boolean') {
    next.lowConfidenceStops = patch.lowConfidenceStops;
  }
  if (
    patch.agentMode === 'auto_recover' ||
    patch.agentMode === 'review_first' ||
    patch.agentMode === 'manual_only'
  ) {
    next.agentMode = patch.agentMode;
  }

  current = next;
  return getGuardrailConfig();
}
