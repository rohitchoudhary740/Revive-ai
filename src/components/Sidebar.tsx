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
  Search
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
  'ask-revive-ai': <Activity className="w-4 h-4" />,
  'settings': <Settings className="w-4 h-4" />,
};

// Map old IDs to new labels based on the Fintech OS theme
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
      className="w-64 bg-[#F8F9FA] text-[#1C1C1C] flex flex-col h-screen fixed top-0 left-0 border-r border-[#EAEAEA] z-30 select-none"
    >
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1C1C1C] text-sm tracking-tight uppercase">
                REVIVE AI
              </span>
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 font-mono">
              Revenue Recovery OS
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="space-y-1">
          <button
            onClick={() => onNavigate('recovery-control')}
            className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 text-left ${
              currentPage === 'recovery-control'
                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={currentPage === 'recovery-control' ? 'text-blue-600' : 'text-gray-400'}>
                {ICONS_MAP['recovery-control']}
              </span>
              <span className="tracking-wide">Command Center</span>
            </div>
            {currentPage === 'recovery-control' && (
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
              </span>
            )}
          </button>
        </div>

        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="space-y-2">
            {section.title && (
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-3 mb-1">
                {section.title === 'Revenue' ? 'Intelligence' : section.title === 'Recovery' ? 'Operations' : section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.filter(item => VISIBLE_IDS.includes(item.id)).map((item) => {
                const isActive = currentPage === item.id;
                const label = NEW_LABELS[item.id] || item.label;
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 text-left ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                          {ICONS_MAP[item.id]}
                        </span>
                        <span className="truncate">{label}</span>
                      </div>
                      
                      {item.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-white text-gray-500 border border-gray-200">
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
      <div className="p-4">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 text-xs font-medium px-3 py-2 rounded-md transition-all ${
            currentPage === 'settings'
              ? 'bg-blue-50 text-blue-700 border border-blue-100/50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 border border-transparent'
          }`}
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span>Settings</span>
        </button>

        <div className="mt-4 flex items-center justify-between text-[9px] text-gray-400 font-mono px-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>SYS_ONLINE</span>
          </div>
          <span>V2.0.4</span>
        </div>
      </div>
    </aside>
  );
};
