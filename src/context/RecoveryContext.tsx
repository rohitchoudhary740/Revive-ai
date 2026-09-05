import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ActiveRecoveryItem } from '../types';

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: 'RECOVERY_SUCCESS' | 'SAFETY_APPROVED' | 'AI_DIAGNOSIS' | 'PAYMENT_FAILURE' | 'MANUAL_OVERRIDE';
  paymentId: string;
  customerName: string;
  amount: number;
  strategy: string;
  details: string;
  actor: 'ReviveAI Autonomous Agent' | 'Policy Engine' | 'Merchant Admin';
  status: 'VERIFIED' | 'COMPLIANT' | 'EXECUTED';
}

interface OverviewMetrics {
  revenueAtRisk: number;
  failedTransactionCount: number;
  recoveredAmount: number;
  recoveredCount: number;
  openCasesCount: number;
  awaitingApprovalCount: number;
}

interface RecoveryContextType {
  revenueAtRisk: number;        // in numeric INR, from backend
  recoveredToday: number;       // in numeric INR, from backend
  recoverable: number;          // in numeric INR, from backend
  failedCount: number;          // count of failed transactions
  openCasesCount: number;       // open recovery cases
  awaitingApprovalCount: number;
  activeRecoveries: ActiveRecoveryItem[];
  auditTrail: AuditEvent[];
  metricsLoading: boolean;
  metricsError: string | null;
  refreshMetrics: () => void;
  completeRecovery: (paymentData: {
    paymentId: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    failureReason: string;
    strategy: string;
    aiConfidence: number;
    recoveryProbability: number;
  }) => void;
  resetDemoData: () => void;
}

const RecoveryContext = createContext<RecoveryContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Map backend case format → ActiveRecoveryItem shape
function caseToActiveItem(c: any): ActiveRecoveryItem {
  return {
    id: c.id,
    recoveryId: c.recoveryId,
    customerName: c.customerName,
    customerEmail: c.customerEmail,
    avatar: c.avatar,
    amount: c.amount,
    problem: c.problem,
    aiAction: c.aiAction,
    recoveryProbability: c.recoveryProbability,
    expectedRecovery: c.expectedRecovery,
    status: c.status,
    currentStage: c.currentStage,
    progressSteps: c.progressSteps || [],
    timeline: c.timeline || [],
    aiRecommendation: c.aiRecommendation,
    safetyChecks: c.safetyChecks || [],
    guardrailDecision: c.guardrailDecision ?? null,
    paymentUrl: c.paymentUrl ?? null,
  };
}

export const RecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── Metrics from backend ────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    revenueAtRisk: 0,
    failedTransactionCount: 0,
    recoveredAmount: 0,
    recoveredCount: 0,
    openCasesCount: 0,
    awaitingApprovalCount: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // ── Active recoveries from backend ─────────────────────────────────────────
  const [activeRecoveries, setActiveRecoveries] = useState<ActiveRecoveryItem[]>([]);

  // ── Local audit trail (seeded from backend + enriched by simulation) ────────
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);

  // ── In-session simulation delta (so the demo recovery flow still works) ─────
  // These are applied ON TOP of backend values so a demo recovery is immediately visible
  const [deltaRecovered, setDeltaRecovered] = useState(0);
  const [deltaAtRisk, setDeltaAtRisk] = useState(0);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const [overviewRes, casesRes, auditRes] = await Promise.all([
        fetch('/api/metrics/overview'),
        fetch('/api/recovery/cases'),
        fetch('/api/audit-trail'),
      ]);

      if (overviewRes.ok) {
        const data: OverviewMetrics = await overviewRes.json();
        setMetrics(data);
      } else {
        throw new Error(`Overview API ${overviewRes.status}`);
      }

      if (casesRes.ok) {
        const cases: any[] = await casesRes.json();
        setActiveRecoveries(cases.map(caseToActiveItem));
      }

      if (auditRes.ok) {
        const audits: any[] = await auditRes.json();
        // Map backend audit format → AuditEvent type
        const mapped: AuditEvent[] = audits.map((a) => ({
          id: a.id,
          timestamp: a.timestamp,
          eventType: (a.eventType as AuditEvent['eventType']) || 'AI_DIAGNOSIS',
          paymentId: a.paymentId || a.case_id || '',
          customerName: a.customerName || 'System',
          amount: a.amount || 0,
          strategy: a.strategy || 'System Log',
          details: a.details || '',
          actor: (a.actor as AuditEvent['actor']) || 'ReviveAI Autonomous Agent',
          status: (a.status as AuditEvent['status']) || 'EXECUTED',
        }));
        setAuditTrail(mapped);
      }
    } catch (err: any) {
      setMetricsError(err.message ?? 'Failed to load metrics');
      console.warn('[RecoveryContext] Backend unavailable, metrics will show 0:', err.message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Computed values (backend + in-session simulation deltas) ─────────────────
  const revenueAtRisk = Math.max(0, metrics.revenueAtRisk + deltaAtRisk);
  const recoveredToday = metrics.recoveredAmount + deltaRecovered;
  // Recoverable is a fraction of remaining at-risk (use 62% as proxy when no AI data available)
  const recoverable = Math.max(0, revenueAtRisk * 0.62);

  // ── completeRecovery: called by the simulation flow in RecoveryControlPage ───
  // This does NOT touch the DB — the backend already persists via /api/recovery/failures webhook.
  // It updates the in-memory delta so the UI responds instantly, and re-fetches after a delay.
  const completeRecovery = (paymentData: {
    paymentId: string;
    customerName: string;
    customerEmail: string;
    amount: number;
    failureReason: string;
    strategy: string;
    aiConfidence: number;
    recoveryProbability: number;
  }) => {
    // 1. Update in-session deltas so UI shows change immediately
    setDeltaRecovered((prev) => prev + paymentData.amount);
    setDeltaAtRisk((prev) => prev - paymentData.amount);

    // 2. Add to local audit trail immediately
    const now = new Date();
    const newAudit: AuditEvent = {
      id: `AUD-${Math.floor(8900 + Math.random() * 999)}`,
      timestamp: now.toISOString(),
      eventType: 'RECOVERY_SUCCESS',
      paymentId: paymentData.paymentId,
      customerName: paymentData.customerName,
      amount: paymentData.amount,
      strategy: paymentData.strategy,
      details: `ReviveAI Autonomous Agent successfully recovered ₹${paymentData.amount.toLocaleString('en-IN')} via ${paymentData.strategy}. PCI-DSS verified.`,
      actor: 'ReviveAI Autonomous Agent',
      status: 'VERIFIED',
    };
    setAuditTrail((prev) => [newAudit, ...prev]);

    // 3. Add a completed item to active recoveries
    const completedItem: ActiveRecoveryItem = {
      id: `rec-live-${Date.now()}`,
      recoveryId: `#REC-${Math.floor(10000 + Math.random() * 90000)}`,
      customerName: paymentData.customerName,
      customerEmail: paymentData.customerEmail,
      avatar: paymentData.customerName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      amount: paymentData.amount,
      problem: paymentData.failureReason,
      aiAction: paymentData.strategy,
      recoveryProbability: paymentData.recoveryProbability,
      expectedRecovery: Math.round(paymentData.amount * paymentData.recoveryProbability / 100),
      status: 'Completed',
      currentStage: 'Payment Verified & Settled',
      progressSteps: [
        { name: 'Diagnosis', status: 'done' },
        { name: 'Policy', status: 'done' },
        { name: 'Action', status: 'done' },
        { name: 'Waiting', status: 'done' },
        { name: 'Verification', status: 'done' },
      ],
      timeline: [
        { title: 'Payment Failed', description: `Issuer returned ${paymentData.failureReason}`, timestamp: 'Just now', status: 'done' },
        { title: 'AI Diagnosis', description: `Gemini diagnosed transient bank degradation (Confidence: ${paymentData.aiConfidence}%)`, timestamp: 'Just now', status: 'done' },
        { title: 'Policy Check Passed', description: 'Deterministic safety rules verified', timestamp: 'Just now', status: 'done' },
        { title: 'Recovery Executed', description: `${paymentData.strategy} deployed`, timestamp: 'Just now', status: 'done' },
        { title: 'Payment Verified & Settled', description: `₹${paymentData.amount.toLocaleString('en-IN')} successfully settled`, timestamp: 'Just now', status: 'done' },
      ],
      aiRecommendation: `Autonomous ${paymentData.strategy} executed successfully.`,
      safetyChecks: [
        { label: 'Retry limit OK (0/1 used)', passed: true },
        { label: 'Amount limit OK', passed: true },
        { label: 'No duplicate recovery', passed: true },
        { label: 'Contact frequency safe', passed: true },
      ],
    };
    setActiveRecoveries((prev) => [completedItem, ...prev]);

    // 4. Re-fetch after 3s so backend-confirmed data replaces deltas
    setTimeout(() => {
      fetchMetrics();
      // Reset deltas — backend now has the truth
      setDeltaRecovered(0);
      setDeltaAtRisk(0);
    }, 3000);
  };

  const resetDemoData = useCallback(() => {
    setDeltaRecovered(0);
    setDeltaAtRisk(0);
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <RecoveryContext.Provider
      value={{
        revenueAtRisk,
        recoveredToday,
        recoverable,
        failedCount: metrics.failedTransactionCount,
        openCasesCount: metrics.openCasesCount,
        awaitingApprovalCount: metrics.awaitingApprovalCount,
        activeRecoveries,
        auditTrail,
        metricsLoading,
        metricsError,
        refreshMetrics: fetchMetrics,
        completeRecovery,
        resetDemoData,
      }}
    >
      {children}
    </RecoveryContext.Provider>
  );
};

export const useRecovery = () => {
  const context = useContext(RecoveryContext);
  if (!context) {
    throw new Error('useRecovery must be used within a RecoveryProvider');
  }
  return context;
};
