import React from 'react';
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
} from 'lucide-react';

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
    icon: <Layers className="w-6 h-6" />,
    tags: ['Live', 'Real-Time'],
  },
  'merchant-overview': {
    title: 'Merchant Overview',
    category: 'COMMAND CENTER',
    description: 'Backend-driven merchant dashboard with live recovery metrics',
    icon: <Layers className="w-6 h-6" />,
    tags: ['Live', 'API-Driven'],
  },
  'revenue-at-risk': {
    title: 'Revenue at Risk',
    category: 'REVENUE',
    description: 'Deep breakdown of failed transactions, downtime impacts, and at-risk MRR/ARR streams',
    icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    tags: ['Failed Payments', 'Bank Degradation', 'Risk Scoring'],
  },
  'recovery-opportunities': {
    title: 'Recovery Opportunities',
    category: 'REVENUE',
    description: 'High-confidence AI recovery leads queued for automated or manual intervention',
    icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
    tags: ['14 Actionable Leads', 'Smart Retries', 'Alternative Rails'],
  },
  'customers': {
    title: 'Customers',
    category: 'REVENUE',
    description: 'Customer payment health scores, retry preferences, and billing contact channels',
    icon: <Users className="w-6 h-6 text-blue-500" />,
    tags: ['Health Scores', 'Saved Mandates', 'Dunning History'],
  },
  'active-recoveries': {
    title: 'Active Recoveries',
    category: 'RECOVERY',
    description: 'Live executions of smart retries, WhatsApp interactive pay hooks, and bank switches',
    icon: <Activity className="w-6 h-6 text-emerald-500" />,
    tags: ['42 Running Tasks', 'Webhooks Connected', 'Auto-Routing'],
  },
  'campaigns': {
    title: 'Campaigns',
    category: 'RECOVERY',
    description: 'Multi-channel dunning cadences, WhatsApp & SMS templates, and incentive discounts',
    icon: <Megaphone className="w-6 h-6 text-purple-500" />,
    tags: ['WhatsApp Flows', 'Smart Retries', 'Custom Cadence'],
  },
  'recovery-strategies': {
    title: 'Recovery Strategies',
    category: 'RECOVERY',
    description: 'Configurable AI decision rules for fallback routing, mandate splitting, and time-of-day retry',
    icon: <GitFork className="w-6 h-6 text-indigo-500" />,
    tags: ['Routing Trees', 'Predictive Timing', 'PSP Optimization'],
  },
  'approvals': {
    title: 'Approvals',
    category: 'CONTROL',
    description: 'Human-in-the-loop review queue for high-value transaction discounts and manual overrides',
    icon: <CheckSquare className="w-6 h-6 text-amber-500" />,
    tags: ['3 Awaiting Review', 'Risk Gatekeepers', 'Audit Check'],
  },
  'audit-trail': {
    title: 'Audit Trail',
    category: 'CONTROL',
    description: 'Immutable ledger of AI actions, gateway webhook receipts, and compliance verification',
    icon: <History className="w-6 h-6 text-slate-500" />,
    tags: ['PCI-DSS Aligned', 'RBI Mandate Log', 'Full Traceability'],
  },
  'ask-revive-ai': {
    title: 'Ask Revive AI',
    category: 'COPILOT',
    description: 'Autonomous copilot for simulated recoveries, root-cause diagnostics, and revenue analytics',
    icon: <Bot className="w-6 h-6 text-indigo-600" />,
    tags: ['Natural Language', 'Simulation Mode', 'Agent Copilot'],
  },
  'settings': {
    title: 'Settings',
    category: 'CONFIG',
    description: 'Razorpay API credentials, Webhook secret keys, SMS/WhatsApp gateways, and team roles',
    icon: <Settings className="w-6 h-6 text-slate-600" />,
    tags: ['Razorpay Live Keys', 'Webhook Endpoints', 'Thresholds'],
  },
};

const ApprovalsSection = () => {
  const [cases, setCases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/recovery/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data.filter((c: any) => c.status === 'Awaiting Approval'));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
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
      setSuccess('Case approved and pipeline restarted successfully.');
      await fetchCases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Human-In-The-Loop Approval Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Transactions exceeding ₹25,000 or with confidence &lt;80% require operator review.
          </p>
        </div>
        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
          {loading ? '...' : cases.length} Pending Reviews
        </span>
      </div>

      {error && <div className="p-3 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
      {success && <div className="p-3 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg">{success}</div>}

      {cases.length === 0 && !loading && (
        <p className="text-xs text-slate-500 py-4 text-center">No cases currently require human approval.</p>
      )}

      {cases.map((c: any) => (
        <div key={c.id} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{c.customerName} ({c.recoveryId})</span>
              <span className="px-2 py-0.2 rounded bg-amber-200 text-amber-900 font-mono font-bold text-[10px]">
                High Amount (₹{c.amount})
              </span>
            </div>
            <p className="text-slate-600 mt-1">
              AI recommends dispatching dedicated link with {(c.recoveryProbability * 100).toFixed(0)}% recovery probability.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => handleApprove(c.id)}
              disabled={approvingId === c.id}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all">
              {approvingId === c.id ? 'Approving...' : 'Approve Link'}
            </button>
            <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all">
              Modify
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const AuditTrailSection = () => {
  const [events, setEvents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Immutable Compliance & Action Ledger</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every ReviveAI recovery decision and verification event is cryptographically logged.
          </p>
        </div>
        <span className="text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">
          PCI-DSS Tier 1 Ready
        </span>
      </div>

      {loading && (
        <p className="text-xs text-slate-500 py-6 text-center">Loading audit trail...</p>
      )}
      {error && (
        <div className="m-4 p-3 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-slate-500 py-6 text-center">No audit events recorded yet.</p>
      )}

      <div className="divide-y divide-slate-100">
        {events.map((log: any) => (
          <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 font-mono">{log.id}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-slate-800">{log.eventType}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                    {log.paymentId}
                  </span>
                </div>
                <p className="text-slate-600 mt-0.5">{log.details}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                  <span>Actor: {log.actor}</span>
                  <span>•</span>
                  <span>Status: {log.status}</span>
                </div>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4">
              <div className="text-[10px] text-slate-400 font-mono">{log.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ pageId, onNavigate }) => {
  const meta = PAGE_META[pageId] || {
    title: pageId,
    category: 'SECTION',
    description: 'Module under configuration for Razorpay Buildathon.',
    icon: <Layers className="w-6 h-6" />,
    tags: ['Placeholder'],
  };

  return (
    <div id={`page-${pageId}`} className="space-y-6 pb-12 max-w-5xl">
      {/* Header Banner */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs">
            {meta.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-wider font-mono">
              <span>{meta.category}</span>
              <span>•</span>
              <span>Razorpay Buildathon Module</span>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {meta.title}
            </h2>

            <p className="text-sm text-slate-600 mt-2 font-medium leading-relaxed">
              {meta.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {meta.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/80 font-mono shadow-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Special Content for Audit Trail */}
      {pageId === 'audit-trail' ? (
        <AuditTrailSection />
      ) : pageId === 'approvals' ? (
        <ApprovalsSection />
      ) : (
        /* Module Placeholder Card */
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-10 border border-dashed border-slate-300 text-center flex flex-col items-center justify-center min-h-[300px] shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center mb-4 shadow-xs">
            <Layers className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            {meta.title} Module Operational
          </h3>

          <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-6 leading-relaxed">
            Navigation routing and state hooks are connected. Use Recovery Control for the live demonstration.
          </p>

          <button
            onClick={() => onNavigate('recovery-control')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <span>Go to Recovery Control (Hero)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
