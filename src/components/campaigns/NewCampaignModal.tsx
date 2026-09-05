import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Layers,
  Zap,
} from 'lucide-react';
import { CampaignTarget, NewCampaignFormData } from '../../types';

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSuccess: (campaignData: NewCampaignFormData) => void;
}

export const NewCampaignModal: React.FC<NewCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreateSuccess,
}) => {
  const [formData, setFormData] = useState<NewCampaignFormData>({
    name: 'Smart UPI Failure Recovery Batch',
    target: 'Payment Failures',
    failureType: 'Temporary',
    amountRangeMin: 1000,
    amountRangeMax: 50000,
    strategy: 'AI Optimized',
    maxAttempts: 1,
    humanApprovalThreshold: 25000,
    communicationLimit: 2,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateSuccess(formData);
  };

  return (
    <div
      id="new-campaign-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity"
      onClick={onClose}
    >
      <div
        id="new-campaign-modal"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Create Recovery Campaign
              </h2>
              <p className="text-xs text-slate-500">
                Configure automated batch recovery rules for revenue at risk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Campaign Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-mono mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Weekend Checkout Rescue"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-mono mb-1.5">
                Target
              </label>
              <select
                value={formData.target}
                onChange={(e) =>
                  setFormData({ ...formData, target: e.target.value as CampaignTarget })
                }
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                <option value="Payment Failures">Payment Failures</option>
                <option value="Checkout Abandonment">Checkout Abandonment</option>
                <option value="Subscription Failures">Subscription Failures</option>
                <option value="Overdue Receivables">Overdue Receivables</option>
              </select>
            </div>

            {/* Failure Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-mono mb-1.5">
                Failure Type Filter
              </label>
              <select
                value={formData.failureType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    failureType: e.target.value as NewCampaignFormData['failureType'],
                  })
                }
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                <option value="All">All Failure Types</option>
                <option value="Temporary">Temporary (Bank/Network Degradation)</option>
                <option value="High Probability">High Probability (&gt;70% Score)</option>
                <option value="Custom">Custom Scope</option>
              </select>
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-mono mb-1.5">
              Amount Range (INR)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={formData.amountRangeMin}
                  onChange={(e) =>
                    setFormData({ ...formData, amountRangeMin: Number(e.target.value) })
                  }
                  placeholder="Min"
                  className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  value={formData.amountRangeMax}
                  onChange={(e) =>
                    setFormData({ ...formData, amountRangeMax: Number(e.target.value) })
                  }
                  placeholder="Max"
                  className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-mono mb-1.5">
              Recovery Strategy
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'AI Optimized', label: 'AI Optimized (Recommended)' },
                { id: 'Delayed Retry', label: 'Delayed Retry' },
                { id: 'Payment Link', label: 'Payment Link' },
                { id: 'WhatsApp', label: 'WhatsApp' },
                { id: 'Email', label: 'Email' },
              ].map((strat) => (
                <button
                  type="button"
                  key={strat.id}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      strategy: strat.id as NewCampaignFormData['strategy'],
                    })
                  }
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    formData.strategy === strat.id
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{strat.label}</span>
                    {formData.strategy === strat.id && (
                      <Zap className="w-3 h-3 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Guardrails / Thresholds */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Campaign Guardrails & Thresholds</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Max Attempts */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                  Max Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={formData.maxAttempts}
                  onChange={(e) =>
                    setFormData({ ...formData, maxAttempts: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                />
              </div>

              {/* Human Approval Threshold */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                  Human Approval Threshold
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={formData.humanApprovalThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        humanApprovalThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Communication Limit */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                  Comm. Limit / Customer
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={formData.communicationLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, communicationLimit: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98]"
            >
              <span>Create Campaign</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
