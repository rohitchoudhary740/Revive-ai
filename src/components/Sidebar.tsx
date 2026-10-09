import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Activity,
  Megaphone,
  CheckSquare,
  History,
  Settings,
  ShieldCheck,
  Zap,
  BarChart3,
  Bot
} from 'lucide-react';
import { PageId } from '../types';
import { NAV_SECTIONS } from '../data/mockData';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const VISIBLE_IDS: PageId[] = [
  'merchant-overview',
  'revenue-at-risk',
  'recovery-opportunities',
  'approvals',
  'audit-trail',
];

const ICONS_MAP: Record<PageId, React.ReactNode> = {
  'recovery-control': <Zap className="w-4 h-4" />,
  'overview': <LayoutDashboard className="w-4 h-4" />,
  'merchant-overview': <BarChart3 className="w-4 h-4" />,
  'revenue-at-risk': <AlertTriangle className="w-4 h-4" />,
  'recovery-opportunities': <Activity className="w-4 h-4" />,
  'customers': <Users className="w-4 h-4" />,
  'active-recoveries': <Activity className="w-4 h-4" />,
  'campaigns': <Megaphone className="w-4 h-4" />,
  'recovery-strategies': <LayoutDashboard className="w-4 h-4" />,
  'approvals': <CheckSquare className="w-4 h-4" />,
  'audit-trail': <History className="w-4 h-4" />,
  'ask-revive-ai': <Bot className="w-4 h-4" />,
  'settings': <Settings className="w-4 h-4" />,
};

// Labels aligned to fintech OS theme
const NEW_LABELS: Partial<Record<PageId, string>> = {
  'merchant-overview': 'Revenue Intelligence',
  'revenue-at-risk': 'Payment Signals',
  'recovery-opportunities': 'Recovery Engine',
  'approvals': 'Risk Approvals',
  'audit-trail': 'Agent Activity',
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  return (
    <aside
      id="revive-sidebar"
      className="w-64 bg-[var(--bg-surface)] text-[var(--text-primary)] flex flex-col h-screen fixed top-0 left-0 border-r border-[var(--border-app)] z-30 select-none transition-colors duration-200"
    >
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-[var(--border-app)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm shadow-blue-500/20">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[var(--text-primary)] text-sm tracking-tight">
                REVIVEAI
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono">
              Revenue Recovery OS
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Hero Section: Command Center */}
        <div className="space-y-1">
          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider px-3 mb-1">
            CONTROL CENTER
          </p>
          <button
            onClick={() => onNavigate('recovery-control')}
            className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 text-left cursor-pointer ${
              currentPage === 'recovery-control'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-500/25 font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={currentPage === 'recovery-control' ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-muted)]'}>
                {ICONS_MAP['recovery-control']}
              </span>
              <span className="tracking-wide">Command Center</span>
            </div>
            {currentPage === 'recovery-control' && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
            )}
          </button>
        </div>

        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider px-3 mb-1">
                {section.title === 'Revenue' ? 'INTELLIGENCE' : section.title === 'Recovery' ? 'OPERATIONS' : section.title.toUpperCase()}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.filter((item) => VISIBLE_IDS.includes(item.id)).map((item) => {
                const isActive = currentPage === item.id;
                const label = NEW_LABELS[item.id] || item.label;

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-left cursor-pointer ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-500/25 font-bold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-muted)]'}>
                          {ICONS_MAP[item.id]}
                        </span>
                        <span className="truncate">{label}</span>
                      </div>

                      {item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-app)]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Settings & Footer */}
      <div className="p-4 border-t border-[var(--border-app)] space-y-3">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-2.5 text-xs font-medium px-3 py-2 rounded-lg transition-all cursor-pointer ${
            currentPage === 'settings'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-bold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4 text-[var(--text-muted)]" />
          <span>System Settings</span>
        </button>

        <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] font-mono px-3 pt-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>SYS_ONLINE</span>
          </div>
          <span>Razorpay Track 03</span>
        </div>
      </div>
    </aside>
  );
};
