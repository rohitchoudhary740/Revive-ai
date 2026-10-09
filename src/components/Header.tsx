import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Bell,
  Search,
  Check,
  ChevronDown,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { PageId } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';

interface HeaderProps {
  currentPage: PageId;
  onRefresh?: () => void;
}

const PAGE_CONTEXTS: Record<PageId, { title: string; category: string; context: string }> = {
  'recovery-control': {
    title: 'Command Center',
    category: 'OPERATIONS',
    context: 'Autonomous payment failure recovery & live decision engine',
  },
  'overview': {
    title: 'System Overview',
    category: 'SYSTEM',
    context: 'Executive revenue recovery command center & performance',
  },
  'merchant-overview': {
    title: 'Revenue Intelligence',
    category: 'INTELLIGENCE',
    context: 'Real-time revenue risk telemetry & autonomous recovery performance',
  },
  'revenue-at-risk': {
    title: 'Payment Signals',
    category: 'SIGNALS',
    context: 'Failed transaction streams & bank gateway degradation monitoring',
  },
  'recovery-opportunities': {
    title: 'Recovery Engine',
    category: 'OPERATIONS',
    context: 'AI-prioritized recoverable revenue pipeline & actionable leads',
  },
  'customers': {
    title: 'Customer Intelligence',
    category: 'INTELLIGENCE',
    context: 'Payment health profiles, saved mandates & customer friction history',
  },
  'active-recoveries': {
    title: 'Active Operations',
    category: 'OPERATIONS',
    context: 'Running autonomous recovery tasks & channel dispatches',
  },
  'campaigns': {
    title: 'Automated Operations',
    category: 'OPERATIONS',
    context: 'Multi-channel dunning cadences & customer recovery flows',
  },
  'recovery-strategies': {
    title: 'Strategy Matrix',
    category: 'SYSTEM',
    context: 'Authoritative recovery strategy registry & scoring weights',
  },
  'approvals': {
    title: 'Risk Approvals',
    category: 'CONTROL',
    context: 'Human-in-the-loop review queue for policy-gated transactions',
  },
  'audit-trail': {
    title: 'Agent Activity',
    category: 'CONTROL',
    context: 'Cryptographically verified autonomous action ledger',
  },
  'ask-revive-ai': {
    title: 'Copilot',
    category: 'AI',
    context: 'Autonomous agent diagnostics & interactive simulation queries',
  },
  'settings': {
    title: 'System Configuration',
    category: 'CONFIG',
    context: 'Razorpay Test Mode credentials, webhooks & merchant guardrails',
  },
};

export const Header: React.FC<HeaderProps> = ({ currentPage, onRefresh }) => {
  const currentInfo = PAGE_CONTEXTS[currentPage] || {
    title: 'Command Center',
    category: 'REVIVE AI',
    context: 'Autonomous revenue protection',
  };

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const THEME_OPTIONS: { id: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'light',
      label: 'Light',
      desc: 'Clean & high contrast',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'dark',
      label: 'Dark',
      desc: 'Deep fintech obsidian',
      icon: <Moon className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'system',
      label: 'System',
      desc: 'Follows OS preference',
      icon: <Monitor className="w-4 h-4 text-blue-500" />,
    },
  ];

  return (
    <header className="sticky top-0 bg-[var(--bg-app)]/85 backdrop-blur-md border-b border-[var(--border-app)] z-20 px-8 py-3.5 flex items-center justify-between transition-colors duration-200">
      {/* LEFT: Breadcrumb and title hierarchy */}
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">
          <span>{currentInfo.category}</span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-[var(--text-secondary)]">{currentInfo.title}</span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
            {currentInfo.title}
          </h1>
          <span className="text-xs text-[var(--text-muted)] hidden md:inline truncate max-w-md font-medium">
            — {currentInfo.context}
          </span>
        </div>
      </div>

      {/* RIGHT: Controls, Status Pills, Theme Selector & Account */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* 1. TEST MODE BADGE (Amber semantic) */}
        <div
          title="Operating in Razorpay Test Mode — All simulations & recoveries use mock payment instruments"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold fintech-badge-warn select-none shadow-xs"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="tracking-wider">TEST MODE</span>
        </div>

        {/* 2. AGENT STATUS BADGE (Green semantic verified/recovered) */}
        <div
          title="ReviveAI Autonomous Agent is actively monitoring failure signals and executing policy-bounded recoveries"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold fintech-badge-success select-none shadow-xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="tracking-widest">● AUTONOMOUS</span>
        </div>

        {/* 3. REUSABLE THEME SELECTOR (Light / Dark / System) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            aria-expanded={themeDropdownOpen}
            aria-haspopup="menu"
            id="theme-selector-btn"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-xs cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-blue-500"
            title={`Current theme: ${theme} (Active: ${resolvedTheme})`}
            aria-label="Theme settings"
          >
            {theme === 'system' ? (
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
            ) : resolvedTheme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-[11px] font-mono capitalize hidden sm:inline">
              {theme === 'system' ? `Auto (${resolvedTheme})` : theme}
            </span>
            <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-150 ${themeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {themeDropdownOpen && (
            <div
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="theme-selector-btn"
              className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xl p-1.5 z-50 text-xs font-medium space-y-1 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1">
                Appearance
              </div>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setTheme(opt.id);
                      setThemeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">{opt.icon}</div>
                      <div className="truncate">
                        <div className="text-xs leading-none font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-normal mt-0.5 leading-none">
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. REFRESH BUTTON */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh current state"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] hover:border-[var(--border-strong)] transition-all shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 5. ACCOUNT / MERCHANT BADGE */}
        <div
          title="Merchant Organization: Razorpay Test Merchant #rzp_test_revive"
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-lg text-xs font-semibold select-none shadow-xs"
        >
          <div className="w-6 h-6 rounded-md bg-blue-600 text-white font-mono text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
            R
          </div>
          <div className="hidden lg:block leading-tight text-left">
            <span className="text-[11px] font-bold text-[var(--text-primary)] block">Acme Merchant</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] block">Org #rzp_test_928</span>
          </div>
        </div>
      </div>
    </header>
  );
};
