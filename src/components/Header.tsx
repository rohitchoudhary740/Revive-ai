import React from 'react';
import { Search, Bell, Calendar, RefreshCw } from 'lucide-react';
import { PageId } from '../types';

interface HeaderProps {
  currentPage: PageId;
  onRefresh?: () => void;
}

const PAGE_TITLES: Record<PageId, { title: string; category: string }> = {
  'recovery-control': { title: 'Command Center', category: 'SYSTEM' },
  'overview': { title: 'System Overview', category: 'SYSTEM' },
  'merchant-overview': { title: 'Revenue Intelligence', category: 'INTELLIGENCE' },
  'revenue-at-risk': { title: 'Payment Signals', category: 'SIGNALS' },
  'recovery-opportunities': { title: 'Recovery Engine', category: 'OPERATIONS' },
  'customers': { title: 'Customer Intelligence', category: 'INTELLIGENCE' },
  'active-recoveries': { title: 'Active Operations', category: 'OPERATIONS' },
  'campaigns': { title: 'Automated Operations', category: 'OPERATIONS' },
  'recovery-strategies': { title: 'Strategy Matrix', category: 'SYSTEM' },
  'approvals': { title: 'Risk Approvals', category: 'CONTROL' },
  'audit-trail': { title: 'Agent Activity', category: 'CONTROL' },
  'ask-revive-ai': { title: 'Copilot', category: 'AI' },
  'settings': { title: 'System Configuration', category: 'CONFIG' },
};

export const Header: React.FC<HeaderProps> = ({ currentPage, onRefresh }) => {
  const currentInfo = PAGE_TITLES[currentPage] || { title: 'Command Center', category: 'REVIVE AI' };

  return (
    <header className="sticky top-0 bg-[#FDFDFD]/90 backdrop-blur-md border-b border-[#EAEAEA] z-20 px-8 py-5 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
          <span>{currentInfo.category}</span>
          <span>/</span>
          <span className="text-gray-900">{currentInfo.title}</span>
        </div>
        <h1 className="text-xl font-bold text-[#1C1C1C] tracking-tight">
          {currentInfo.title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden xl:block group">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search signals, IDs..."
            className="pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-200 rounded-md w-48 focus:w-64 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-gray-900 placeholder:text-gray-400 shadow-sm"
          />
        </div>

        {/* Time Window */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[10px] font-semibold text-gray-600 shadow-sm">
          <Calendar className="w-3 h-3 text-gray-400" />
          <span className="uppercase tracking-wider">T-30D Window</span>
        </div>

        {/* Agent Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] font-semibold text-emerald-700 shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
          </span>
          <span className="uppercase tracking-widest">Agent Active</span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-md transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        <button className="relative p-1.5 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-md transition-colors shadow-sm">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  );
};
