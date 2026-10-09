import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Check,
  ArrowRight,
  Layers,
  FileText
} from 'lucide-react';
import { PageId } from '../../types';

export interface AuditRecord {
  id: string;
  timestamp?: string;
  eventType: string;
  paymentId?: string;
  customerName?: string;
  amount?: number;
  strategy?: string;
  details?: string;
  actor?: string;
  status?: string;
}

interface AuditTrailPageProps {
  onNavigate: (page: PageId) => void;
}

export type LedgerCategory =
  | 'all'
  | 'payment_failure'
  | 'ai_diagnosis'
  | 'policy_approval'
  | 'human_escalation'
  | 'recovery_execution'
  | 'payment_verification'
  | 'recovery_success'
  | 'stop_block';

interface EventMeta {
  category: LedgerCategory;
  displayName: string;
  badgeClass: string;
  dotBg: string;
  ringClass: string;
  textClass: string;
  icon: React.ReactNode;
}

const getEventMeta = (eventType?: string, details?: string): EventMeta => {
  const type = (eventType || '').toUpperCase();
  const det = (details || '').toUpperCase();

  // 1. Payment failure
  if (type.includes('PAYMENT_FAIL') || type.includes('FAIL') || det.includes('PAYMENT FAILED')) {
    return {
      category: 'payment_failure',
      displayName: 'Payment Failure',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
      dotBg: 'bg-rose-500',
      ringClass: 'ring-rose-400/30',
      textClass: 'text-rose-600 dark:text-rose-400',
      icon: <XCircle className="w-4 h-4" />
    };
  }

  // 7. Recovery success
  if (
    type.includes('RECOVERY_SUCCESS') ||
    type.includes('SUCCESS') ||
    type.includes('RECOVERED') ||
    det.includes('SUCCESSFULLY CAPTURED') ||
    det.includes('RECOVERED')
  ) {
    return {
      category: 'recovery_success',
      displayName: 'Recovery Success',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
      dotBg: 'bg-emerald-500',
      ringClass: 'ring-emerald-400/30',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-4 h-4" />
    };
  }

  // 6. Payment verification
  if (type.includes('VERIF') || det.includes('VERIFIED') || det.includes('HMAC') || det.includes('SIGNATURE')) {
    return {
      category: 'payment_verification',
      displayName: 'Payment Verification',
      badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
      dotBg: 'bg-teal-500',
      ringClass: 'ring-teal-400/30',
      textClass: 'text-teal-600 dark:text-teal-400',
      icon: <ShieldCheck className="w-4 h-4" />
    };
  }

  // 4. Human escalation
  if (
    type.includes('MANUAL_OVERRIDE') ||
    type.includes('ESCALAT') ||
    type.includes('HUMAN_REVIEW') ||
    det.includes('MANUAL OVERRIDE') ||
    det.includes('OPERATOR') ||
    det.includes('HUMAN APPROVAL')
  ) {
    return {
      category: 'human_escalation',
      displayName: 'Human Escalation',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
      dotBg: 'bg-amber-500',
      ringClass: 'ring-amber-400/30',
      textClass: 'text-amber-600 dark:text-amber-400',
      icon: <UserCheck className="w-4 h-4" />
    };
  }

  // 8. Stop / block
  if (
    type.includes('STOP') ||
    type.includes('BLOCK') ||
    type.includes('CIRCUIT') ||
    det.includes('STOPPED') ||
    det.includes('HALTED') ||
    det.includes('BLOCKED')
  ) {
    return {
      category: 'stop_block',
      displayName: 'Stop / Block',
      badgeClass: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
      dotBg: 'bg-rose-700',
      ringClass: 'ring-rose-500/30',
      textClass: 'text-rose-700 dark:text-rose-300',
      icon: <ShieldAlert className="w-4 h-4" />
    };
  }

  // 2. AI diagnosis
  if (
    type.includes('AI_DIAG') ||
    type.includes('DIAGNOS') ||
    type.includes('GEMINI') ||
    det.includes('DIAGNOSED') ||
    det.includes('AI')
  ) {
    return {
      category: 'ai_diagnosis',
      displayName: 'AI Diagnosis',
      badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
      dotBg: 'bg-purple-600',
      ringClass: 'ring-purple-400/30',
      textClass: 'text-purple-600 dark:text-purple-400',
      icon: <Sparkles className="w-4 h-4" />
    };
  }

  // 3. Policy approval
  if (
    type.includes('POLICY') ||
    det.includes('POLICY CHECK PASSED') ||
    det.includes('GUARDRAIL') ||
    det.includes('POLICY DECISION')
  ) {
    return {
      category: 'policy_approval',
      displayName: 'Policy Approval',
      badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
      dotBg: 'bg-blue-600',
      ringClass: 'ring-blue-400/30',
      textClass: 'text-blue-600 dark:text-blue-400',
      icon: <ShieldCheck className="w-4 h-4" />
    };
  }

  // 5. Recovery execution
  if (
    type.includes('DISPATCH') ||
    type.includes('RECOVERY_EXEC') ||
    type.includes('ACTION') ||
    det.includes('DISPATCHED') ||
    det.includes('RETRY')
  ) {
    return {
      category: 'recovery_execution',
      displayName: 'Recovery Execution',
      badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
      dotBg: 'bg-sky-500',
      ringClass: 'ring-sky-400/30',
      textClass: 'text-sky-600 dark:text-sky-400',
      icon: <Zap className="w-4 h-4" />
    };
  }

  return {
    category: 'all',
    displayName: eventType ? eventType.replace(/_/g, ' ') : 'System Event',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/25',
    dotBg: 'bg-slate-500',
    ringClass: 'ring-slate-400/30',
    textClass: 'text-slate-600 dark:text-slate-400',
    icon: <History className="w-4 h-4" />
  };
};

export const AuditTrailPage: React.FC<AuditTrailPageProps> = ({ onNavigate }) => {
  const [events, setEvents] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<LedgerCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/audit-trail');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load audit ledger`);
      const data: AuditRecord[] = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, []);

  const formatEventTime = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      // If timestamp already has formatted text like "12:30:15 (Just now)"
      if (timestamp.includes(':') && (timestamp.includes('(') || timestamp.length <= 15)) {
        return timestamp;
      }
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp;
      return d.toLocaleTimeString('en-IN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const CATEGORY_TABS: { key: LedgerCategory; label: string }[] = [
    { key: 'all', label: 'All Events' },
    { key: 'payment_failure', label: 'Payment Failure' },
    { key: 'ai_diagnosis', label: 'AI Diagnosis' },
    { key: 'policy_approval', label: 'Policy Approval' },
    { key: 'human_escalation', label: 'Human Escalation' },
    { key: 'recovery_execution', label: 'Recovery Execution' },
    { key: 'payment_verification', label: 'Payment Verification' },
    { key: 'recovery_success', label: 'Recovery Success' },
    { key: 'stop_block', label: 'Stop / Block' },
  ];

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const meta = getEventMeta(ev.eventType, ev.details);
      if (selectedCategory !== 'all' && meta.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesRef = ev.paymentId ? ev.paymentId.toLowerCase().includes(query) : false;
        const matchesDetails = ev.details ? ev.details.toLowerCase().includes(query) : false;
        const matchesType = ev.eventType ? ev.eventType.toLowerCase().includes(query) : false;
        const matchesActor = ev.actor ? ev.actor.toLowerCase().includes(query) : false;
        if (!matchesRef && !matchesDetails && !matchesType && !matchesActor) {
          return false;
        }
      }
      return true;
    });
  }, [events, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto" id="audit-trail-ledger">
      {/* ── HEADER BANNER ────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-7 border border-[var(--border-app)] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-2xs text-blue-600 dark:text-blue-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">
                <span>OPERATIONAL LEDGER</span>
                <span>•</span>
                <span>HMAC VERIFIED & PCI-DSS ALIGNED</span>
              </div>
              <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight mt-1">
                Agent Activity & Audit Trail
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium leading-relaxed max-w-2xl">
                Cryptographically tracked record of payment failures, AI diagnostic evaluations, policy checks, recovery dispatches, and verification milestones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchAuditEvents}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-app)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="pt-5 mt-5 border-t border-[var(--border-app)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by case ID (e.g. case-123), details, or actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
              <span>Showing:</span>
              <span className="font-bold text-[var(--text-primary)]">{filteredEvents.length}</span>
              <span>of {events.length} events</span>
            </div>
          </div>

          {/* Categorical Event Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = selectedCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer font-mono ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-app)] hover:border-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && events.length === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl p-12 border border-[var(--border-app)] text-center flex flex-col items-center justify-center gap-3">
          <Clock className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-bold text-[var(--text-primary)]">Loading Audit Ledger...</p>
          <p className="text-xs text-[var(--text-secondary)]">Retrieving chronological event records from backend storage.</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEvents.length === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl p-12 border border-[var(--border-app)] text-center space-y-2">
          <FileText className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-70" />
          <p className="text-sm font-bold text-[var(--text-primary)]">No Ledger Events Found</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {searchQuery || selectedCategory !== 'all'
              ? 'No events match the selected filter criteria. Try clearing the search or category.'
              : 'No audit records currently stored in the system.'}
          </p>
        </div>
      )}

      {/* ── VERTICAL TIMELINE LEDGER ─────────────────────────────────────── */}
      {filteredEvents.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-app)] shadow-xs p-6">
          <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-app)]">
            {filteredEvents.map((log, idx) => {
              const meta = getEventMeta(log.eventType, log.details);
              const formattedTime = formatEventTime(log.timestamp);
              const hasValidAmount = typeof log.amount === 'number' && log.amount > 0;
              const hasValidStrategy = log.strategy && log.strategy !== 'System Log';
              const hasValidCustomer = log.customerName && log.customerName !== 'Audit Ledger Entry';

              return (
                <div key={log.id || idx} className="relative group">
                  {/* Timeline Bullet Node */}
                  <div
                    className={`absolute -left-[19px] top-1.5 w-4 h-4 rounded-full ${meta.dotBg} ring-4 ${meta.ringClass} flex items-center justify-center text-white shadow-2xs z-10 transition-transform group-hover:scale-110`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  {/* Ledger Event Card */}
                  <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-2xs space-y-2">
                    {/* Header: Event Type, Badges & Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Event Category Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border ${meta.badgeClass}`}>
                          {meta.icon}
                          <span>{meta.displayName}</span>
                        </span>

                        {/* Raw Event Type string if distinct */}
                        <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">
                          [{log.eventType}]
                        </span>

                        {/* Case reference if available */}
                        {log.paymentId && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-app)]">
                            Ref: {log.paymentId}
                          </span>
                        )}

                        {/* Amount ONLY if available and positive */}
                        {hasValidAmount && (
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                            ₹{Number(log.amount).toLocaleString('en-IN')}
                          </span>
                        )}

                        {/* Customer name ONLY if real customer provided */}
                        {hasValidCustomer && (
                          <span className="text-[11px] font-bold text-[var(--text-primary)]">
                            · {log.customerName}
                          </span>
                        )}
                      </div>

                      {/* Timestamp ONLY if available */}
                      {formattedTime && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{formattedTime}</span>
                        </div>
                      )}
                    </div>

                    {/* Event Details Text ONLY if available */}
                    {log.details && (
                      <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed bg-[var(--bg-surface)]/60 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                        {log.details}
                      </p>
                    )}

                    {/* Metadata Footer: Actor, Status, Strategy */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)] flex-wrap pt-0.5">
                      {log.actor && (
                        <span>
                          Actor: <strong className="text-[var(--text-secondary)]">{log.actor}</strong>
                        </span>
                      )}

                      {log.status && (
                        <>
                          <span>•</span>
                          <span>
                            Status: <strong className="text-[var(--text-secondary)]">{log.status}</strong>
                          </span>
                        </>
                      )}

                      {hasValidStrategy && (
                        <>
                          <span>•</span>
                          <span>
                            Strategy: <strong className="text-[var(--text-secondary)]">{log.strategy}</strong>
                          </span>
                        </>
                      )}

                      <span className="ml-auto text-[9px] text-[var(--text-muted)] opacity-75">
                        Event ID: {log.id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
