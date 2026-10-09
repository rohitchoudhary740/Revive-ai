import React, { useState, useEffect } from 'react';
import { PageId } from '../types';
import {
  AlertTriangle,
  Sparkles,
  Users,
  Activity,
  Megaphone,
  GitFork,
  CheckSquare,
  History,
  Bot,
  Settings,
  ArrowRight,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Lock,
  Zap,
  RotateCcw,
  Check
} from 'lucide-react';
import { ApprovalsPage } from './approvals/ApprovalsPage';
import { AuditTrailPage } from './audit/AuditTrailPage';

interface PlaceholderPageProps {
  pageId: PageId;
  onNavigate: (page: PageId) => void;
}

interface PageMeta {
  title: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  tags: string[];
}

const PAGE_META: Record<PageId, PageMeta> = {
  'recovery-control': {
    title: 'Recovery Control',
    category: 'LIVE OPERATIONS',
    description: 'Autonomous payment failure recovery and live decision engine',
    icon: <Sparkles className="w-6 h-6 text-amber-500" />,
    tags: ['Hero Feature', 'Real-Time', 'Gemini AI'],
  },
  'overview': {
    title: 'Overview',
    category: 'COMMAND CENTER',
    description: 'Executive revenue recovery command center',
    icon: <Layers className="w-6 h-6 text-blue-500" />,
    tags: ['Live', 'Real-Time'],
  },
  'merchant-overview': {
    title: 'Merchant Overview',
    category: 'COMMAND CENTER',
    description: 'Backend-driven merchant dashboard with live recovery metrics',
    icon: <Layers className="w-6 h-6 text-blue-500" />,
    tags: ['Live', 'API-Driven'],
  },
  'revenue-at-risk': {
    title: 'Payment Signals',
    category: 'SIGNALS',
    description: 'Deep breakdown of failed transactions, downtime impacts, and at-risk revenue streams',
    icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    tags: ['Failed Payments', 'Bank Degradation', 'Risk Scoring'],
  },
  'recovery-opportunities': {
    title: 'Recovery Engine',
    category: 'OPERATIONS',
    description: 'High-confidence AI recovery leads queued for automated or manual intervention',
    icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
    tags: ['Actionable Leads', 'Smart Retries', 'Alternative Rails'],
  },
  'customers': {
    title: 'Customer Intelligence',
    category: 'INTELLIGENCE',
    description: 'Customer payment health scores, retry preferences, and billing contact channels',
    icon: <Users className="w-6 h-6 text-blue-500" />,
    tags: ['Health Scores', 'Saved Mandates', 'Dunning History'],
  },
  'active-recoveries': {
    title: 'Active Operations',
    category: 'OPERATIONS',
    description: 'Live executions of smart retries, WhatsApp interactive pay hooks, and bank switches',
    icon: <Activity className="w-6 h-6 text-emerald-500" />,
    tags: ['Running Tasks', 'Webhooks Connected', 'Auto-Routing'],
  },
  'campaigns': {
    title: 'Automated Operations',
    category: 'OPERATIONS',
    description: 'Multi-channel dunning cadences, WhatsApp & SMS templates, and incentive discounts',
    icon: <Megaphone className="w-6 h-6 text-purple-500" />,
    tags: ['WhatsApp Flows', 'Smart Retries', 'Custom Cadence'],
  },
  'recovery-strategies': {
    title: 'Strategy Matrix',
    category: 'SYSTEM',
    description: 'Configurable AI decision rules for fallback routing, mandate splitting, and time-of-day retry',
    icon: <GitFork className="w-6 h-6 text-indigo-500" />,
    tags: ['Routing Trees', 'Predictive Timing', 'PSP Optimization'],
  },
  'approvals': {
    title: 'Risk Approvals',
    category: 'CONTROL',
    description: 'Human-in-the-loop review queue for high-value transactions and manual overrides',
    icon: <CheckSquare className="w-6 h-6 text-amber-500" />,
    tags: ['Pending Reviews', 'Risk Gatekeepers', 'Audit Check'],
  },
  'audit-trail': {
    title: 'Agent Activity',
    category: 'CONTROL',
    description: 'Immutable ledger of AI actions, gateway webhook receipts, and compliance verification',
    icon: <History className="w-6 h-6 text-slate-500" />,
    tags: ['PCI-DSS Aligned', 'HMAC Verified', 'Full Traceability'],
  },
  'ask-revive-ai': {
    title: 'Ask Revive AI',
    category: 'COPILOT',
    description: 'Autonomous copilot for simulated recoveries, root-cause diagnostics, and revenue analytics',
    icon: <Bot className="w-6 h-6 text-indigo-600" />,
    tags: ['Natural Language', 'Simulation Mode', 'Agent Copilot'],
  },
  'settings': {
    title: 'System Settings',
    category: 'CONFIG',
    description: 'Razorpay API credentials, Webhook secret keys, SMS/WhatsApp gateways, and merchant guardrails',
    icon: <Settings className="w-6 h-6 text-slate-600" />,
    tags: ['Razorpay Test Mode', 'Webhook Endpoints', 'Thresholds'],
  },
};

const ApprovalsSection = () => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/recovery/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data.filter((c: any) => c.status === 'Awaiting Approval'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/recovery/cases/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to approve case');
      setSuccess('Case approved and recovery pipeline restarted successfully.');
      await fetchCases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-app)] shadow-xs p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-app)]">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Human-In-The-Loop Approval Queue</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Transactions exceeding merchant auto-limit or flagged by policy sentinel require operator review.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
          {loading ? '...' : cases.length} Pending Reviews
        </span>
      </div>

      {error && <div className="p-3 text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/25 rounded-xl">{error}</div>}
      {success && <div className="p-3 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">{success}</div>}

      {cases.length === 0 && !loading && (
        <div className="py-12 text-center text-xs text-[var(--text-secondary)] space-y-1">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
          <p className="font-semibold text-[var(--text-primary)]">Review Queue Clear</p>
          <p className="text-[var(--text-muted)]">No transactions currently awaiting manual merchant approval.</p>
        </div>
      )}

      {cases.map((c: any) => (
        <div key={c.id} className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)]">{c.customerName}</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">({c.recoveryId})</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-bold text-[10px]">
                ₹{Number(c.amount).toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] mt-1">
              AI suggests {c.aiAction || 'authorized recovery'} with {Math.round((c.recoveryProbability || 0) * 100)}% estimated probability.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleApprove(c.id)}
              disabled={approvingId === c.id}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all cursor-pointer shadow-xs text-xs"
            >
              {approvingId === c.id ? 'Approving...' : 'Approve & Dispatch'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// =========================================================================
// 10. AUDIT TRAIL — VERTICAL EVENT LEDGER
// =========================================================================
const AuditTrailSection = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/audit-trail');
        if (!res.ok) throw new Error('Failed to load audit trail');
        const data = await res.json();
        if (active) setEvents(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (active) setError(err.message || 'Failed to load audit trail');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const formatEventTime = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString('en-IN', { hour12: false });
    } catch {
      return timestamp;
    }
  };

  const getNodeColor = (eventType: string) => {
    const et = (eventType || '').toUpperCase();
    if (et.includes('RECOVERED') || et.includes('SUCCESS')) {
      return {
        bg: 'bg-emerald-500',
        ring: 'ring-emerald-400/30',
        text: 'text-emerald-600 dark:text-emerald-400',
        pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
      };
    }
    if (et.includes('VERIFIED')) {
      return {
        bg: 'bg-teal-500',
        ring: 'ring-teal-400/30',
        text: 'text-teal-600 dark:text-teal-400',
        pill: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
      };
    }
    if (et.includes('STRATEGY') || et.includes('ACTION')) {
      return {
        bg: 'bg-blue-600',
        ring: 'ring-blue-400/30',
        text: 'text-blue-600 dark:text-blue-400',
        pill: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
      };
    }
    if (et.includes('SAFETY') || et.includes('POLICY')) {
      return {
        bg: 'bg-indigo-600',
        ring: 'ring-indigo-400/30',
        text: 'text-indigo-600 dark:text-indigo-400',
        pill: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
      };
    }
    if (et.includes('DIAGNOSIS') || et.includes('AI')) {
      return {
        bg: 'bg-purple-600',
        ring: 'ring-purple-400/30',
        text: 'text-purple-600 dark:text-purple-400',
        pill: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
      };
    }
    return {
      bg: 'bg-slate-500',
      ring: 'ring-slate-400/30',
      text: 'text-slate-600 dark:text-slate-400',
      pill: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25',
    };
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-app)] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[var(--border-app)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Vertical Event Ledger</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Immutable trace of recovery events, HMAC webhook receipts, and policy authorization checkpoints.
          </p>
        </div>
        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-lg font-bold">
          HMAC VERIFIED LEDGER
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-xs text-[var(--text-secondary)]">
          <Clock className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading immutable audit ledger...</span>
        </div>
      )}

      {error && (
        <div className="m-5 p-3 text-xs font-bold text-rose-600 bg-rose-500/10 border border-rose-500/25 rounded-xl">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] py-12 text-center">No audit events recorded yet.</p>
      )}

      {/* Vertical Timeline Ledger */}
      <div className="p-6">
        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-app)]">
          {events.map((log: any, idx: number) => {
            const colors = getNodeColor(log.eventType);
            const isLast = idx === events.length - 1;

            return (
              <div key={log.id || idx} className="relative group">
                {/* Node Bullet (●) */}
                <div
                  className={`absolute -left-[19px] top-1 w-4 h-4 rounded-full ${colors.bg} ring-4 ${colors.ring} flex items-center justify-center text-white shadow-xs z-10 transition-transform group-hover:scale-110`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] hover:border-slate-400 transition-all shadow-2xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold font-mono tracking-tight ${colors.text}`}>
                        ● {log.eventType.replace(/_/g, ' ')}
                      </span>
                      {log.amount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          ₹{Number(log.amount).toLocaleString('en-IN')}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-app)]">
                        {log.paymentId || log.id}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {formatEventTime(log.timestamp)}
                    </span>
                  </div>

                  {log.details && (
                    <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                      {log.details}
                    </p>
                  )}

                  <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)] flex-wrap">
                    <span>Actor: <strong className="text-[var(--text-secondary)]">{log.actor || 'ReviveAI Agent'}</strong></span>
                    <span>•</span>
                    <span>Status: <strong className="text-[var(--text-secondary)]">{log.status || 'EXECUTED'}</strong></span>
                    {log.strategy && log.strategy !== 'System Log' && (
                      <>
                        <span>•</span>
                        <span>Strategy: <strong className="text-[var(--text-secondary)]">{log.strategy}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ pageId, onNavigate }) => {
  const meta = PAGE_META[pageId] || {
    title: pageId,
    category: 'SECTION',
    description: 'Module operational in Razorpay Buildathon Test Mode.',
    icon: <Layers className="w-6 h-6 text-blue-500" />,
    tags: ['Operational'],
  };

  return (
    <div id={`page-${pageId}`} className="space-y-6 pb-12 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-7 border border-[var(--border-app)] shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-2xs">
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">
              <span>{meta.category}</span>
              <span>•</span>
              <span>Razorpay Track 03</span>
            </div>

            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight mt-1">
              {meta.title}
            </h2>

            <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium leading-relaxed max-w-2xl">
              {meta.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {meta.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-app)] font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Special Content */}
      {pageId === 'audit-trail' ? (
        <AuditTrailPage onNavigate={onNavigate} />
      ) : pageId === 'approvals' ? (
        <ApprovalsPage onNavigate={onNavigate} />
      ) : (
        /* Module Placeholder Card */
        <div className="bg-[var(--bg-surface)] rounded-2xl p-10 border border-dashed border-[var(--border-app)] text-center flex flex-col items-center justify-center min-h-[280px] shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-2xs">
            <Layers className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {meta.title} Module Operational
          </h3>

          <p className="text-xs text-[var(--text-secondary)] max-w-md mt-1 mb-5 leading-relaxed">
            Connected to Razorpay Test Mode event telemetry and agent services. Use the Command Center for live simulations.
          </p>

          <button
            onClick={() => onNavigate('recovery-control')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>Open Command Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
