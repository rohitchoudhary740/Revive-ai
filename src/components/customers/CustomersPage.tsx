import React, { useState, useMemo } from 'react';
import {
  Users,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ChevronRight,
  ArrowUpDown,
  History,
  Eye,
  Zap,
  RotateCcw,
  Check,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { CUSTOMERS_DATA } from '../../data/customersData';
import { CustomerProfile, CustomerFilterOption, PageId } from '../../types';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';

interface CustomersPageProps {
  onNavigate?: (page: PageId) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<CustomerFilterOption>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredCustomers = useMemo(() => {
    return CUSTOMERS_DATA.filter((customer) => {
      // Filter logic
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'high_risk' && customer.riskCategory === 'High') ||
        (activeFilter === 'recoverable' &&
          (customer.status === 'Recoverable' || customer.status === 'Approval Required')) ||
        (activeFilter === 'recovered' && customer.recoveredRevenue > 0) ||
        (activeFilter === 'stopped' && customer.status === 'Stopped');

      // Search logic (name, email, or customer ID)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        customer.name.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.customerId.toLowerCase().includes(q) ||
        customer.lastEvent.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [searchQuery, activeFilter]);

  const handleOpenCustomer = (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const renderStatusBadge = (status: CustomerProfile['status']) => {
    switch (status) {
      case 'Recoverable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Recoverable
          </span>
        );
      case 'Approval Required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Approval Required
          </span>
        );
      case 'Low Probability':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono shadow-xs">
            <Clock className="w-3 h-3 text-slate-400" />
            Low Probability
          </span>
        );
      case 'Stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600" />
            Stopped
          </span>
        );
      case 'Recovered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono shadow-xs">
            <Check className="w-3 h-3 text-emerald-700" />
            Recovered
          </span>
        );
    }
  };

  return (
    <div id="customers-page" className="space-y-7 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
              Customer Intelligence
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              Account-Level Recovery Context
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Customers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Understand customer-level revenue risk and recovery history.
          </p>
        </div>

        {/* Action Header Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate && onNavigate('recovery-opportunities')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <span>View Opportunities</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="customers-kpi-grid">
        {/* KPI 1: Customers at Risk */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200/90 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Customers at Risk
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-900 tracking-tight font-mono">
                317
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Active leakage accounts</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              Needs Attention
            </span>
          </div>
        </div>

        {/* KPI 2: High-Value Customers */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                High-Value Customers
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Building className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                42
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">&gt;₹25k ticket size</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              VIP Tier
            </span>
          </div>
        </div>

        {/* KPI 3: Recovery Opportunities */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/40 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                Recovery Opportunities
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-900 tracking-tight font-mono">
                137
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Ready for execution</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              AI Actionable
            </span>
          </div>
        </div>

        {/* KPI 4: Revenue Recovered */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-emerald-200/90 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-200/40 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Revenue Recovered
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                ₹3.82L
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total customer rescues</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
              Settled
            </span>
          </div>
        </div>
      </div>

      {/* SEARCH + FILTERS BAR */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'high_risk', label: 'High Risk' },
            { id: 'recoverable', label: 'Recoverable' },
            { id: 'recovered', label: 'Recovered' },
            { id: 'stopped', label: 'Stopped' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as CustomerFilterOption)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 font-mono ${
                activeFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name, email, or ID..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* MAIN CUSTOMER TABLE */}
      <div
        id="section-customer-table"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-4 text-right">Revenue at Risk</th>
                <th className="py-3.5 px-4 text-right">Recoverable</th>
                <th className="py-3.5 px-5">Recovery Probability</th>
                <th className="py-3.5 px-4 text-center">Previous Attempts</th>
                <th className="py-3.5 px-5">Last Event</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No customers match your filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleOpenCustomer(customer)}
                  >
                    {/* Customer */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 shadow-xs">
                          {customer.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{customer.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <span>{customer.customerId}</span>
                            <span>•</span>
                            <span>{customer.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Revenue at Risk */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(customer.revenueAtRisk)}
                    </td>

                    {/* Recoverable */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                      {formatINR(customer.recoverable)}
                    </td>

                    {/* Recovery Probability */}
                    <td className="py-3.5 px-5 min-w-[140px]">
                      <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                        <span
                          className={
                            customer.recoveryProbability >= 70
                              ? 'text-emerald-700'
                              : customer.recoveryProbability >= 40
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }
                        >
                          {customer.recoveryProbability}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            customer.recoveryProbability >= 70
                              ? 'bg-emerald-500'
                              : customer.recoveryProbability >= 40
                              ? 'bg-amber-400'
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${customer.recoveryProbability}%` }}
                        />
                      </div>
                    </td>

                    {/* Previous Attempts */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {customer.previousAttempts}
                      </span>
                    </td>

                    {/* Last Event */}
                    <td className="py-3.5 px-5">
                      <span className="font-semibold text-slate-800">{customer.lastEvent}</span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(customer.status)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustomer(customer);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/60 shadow-2xs transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Customer</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-slate-50/50 backdrop-blur-xs border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <strong>{filteredCustomers.length}</strong> of{' '}
            <strong>{CUSTOMERS_DATA.length}</strong> customer records
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>AI Memory Context: 100% active</span>
          </div>
        </div>
      </div>

      {/* CUSTOMER DETAIL DRAWER */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onNavigateToOpportunities={() => {
          if (onNavigate) {
            onNavigate('recovery-opportunities');
          }
        }}
      />
    </div>
  );
};
