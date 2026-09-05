import React, { useState } from 'react';
import {
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  ExternalLink,
  Bot,
  Activity,
  Sparkles,
  Smartphone,
  MessageSquare,
  CheckCheck,
  History,
  ChevronRight,
  Layers,
  Info,
  DollarSign,
  Award,
  Zap,
} from 'lucide-react';
import { PageId } from '../../types';

interface WorkflowDetailModalProps {
  stepNumber: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
  simulationRecovered?: boolean;
}

export const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({
  stepNumber,
  isOpen,
  onClose,
  onNavigate,
  simulationRecovered = false,
}) => {
  if (!isOpen || stepNumber === null) return null;

  return (
    <div
      id="workflow-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="workflow-detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative animate-scaleIn"
      >
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center font-mono shadow-sm">
              0{stepNumber}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 font-mono">
                Workflow Step Drill-Down
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {stepNumber === 1 && 'Step 01 — Payment Detection'}
                {stepNumber === 2 && 'Step 02 — AI Diagnosis'}
                {stepNumber === 3 && 'Step 03 — Recovery Decision'}
                {stepNumber === 4 && 'Step 04 — Safety & Policy'}
                {stepNumber === 5 && 'Step 05 — WhatsApp Recovery'}
                {stepNumber === 6 && 'Step 06 — Payment Verification'}
                {stepNumber === 7 && 'Step 07 — Revenue Recovered'}
              </h2>
            </div>
          </div>

          <button
            id="close-workflow-detail-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6">
          {/* STEP 01 DRILL DOWN */}
          {stepNumber === 1 && (
            <div className="space-y-5">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Payment ID</span>
                  <span className="text-xs font-bold text-slate-900 font-mono">pay_92831</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Amount</span>
                  <span className="text-xs font-black text-slate-900 font-mono">₹5,000</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Customer</span>
                  <span className="text-xs font-bold text-slate-900">Amit Sharma</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Payment Method</span>
                  <span className="text-xs font-bold text-indigo-700 font-mono">UPI (amit@okhdfcbank)</span>
                </div>
              </div>

              {/* Status Alert Banner */}
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span className="text-xs font-black tracking-wide text-red-700 font-mono">
                      FAILURE CODE: BANK_TIMEOUT
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-red-200 text-red-800 text-[10px] font-bold font-mono">
                    Gateway 504
                  </span>
                </div>
                <div className="text-lg font-black text-red-700 font-mono">
                  ⚠️ ₹5,000 NOT CAPTURED
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  The issuing bank gateway exceeded the 15,000ms SLA timeout. Funds were neither debited nor captured by Razorpay.
                </p>
              </div>

              {/* Gateway & Transaction Status Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Gateway Stream Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Gateway:</span>
                    <span className="font-semibold text-slate-800">Razorpay Primary Node #04</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Transaction Status:</span>
                    <span className="font-bold text-red-600 font-mono">FAILED (Uncaptured)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Timestamp:</span>
                    <span className="font-mono text-slate-700">Today, 10:41:02 AM IST</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Merchant Order ID:</span>
                    <span className="font-mono text-slate-700">#ORD-92831 (Sony Headphones)</span>
                  </div>
                </div>
              </div>

              {/* Execution Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Event Timeline
                </h4>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-700">
                    <span className="font-mono text-[10px] text-slate-400 w-16 shrink-0">10:41:00</span>
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="font-medium">Payment initiated by customer via UPI</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <span className="font-mono text-[10px] text-slate-400 w-16 shrink-0">10:41:01</span>
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="font-medium">Processing payment on HDFC issuer rail...</span>
                  </div>
                  <div className="flex items-center gap-3 text-red-700 font-semibold">
                    <span className="font-mono text-[10px] text-red-400 w-16 shrink-0">10:41:02</span>
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>Payment Failed (BANK_TIMEOUT) — Webhook ingested by ReviveAI</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 02 DRILL DOWN */}
          {stepNumber === 2 && (
            <div className="space-y-5">
              {/* AI Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-700 font-mono block uppercase font-bold">Root Cause</span>
                  <span className="text-xs font-black text-amber-900 block mt-0.5">
                    Temporary Bank Degradation
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-mono block uppercase font-bold">Gemini Confidence</span>
                  <span className="text-sm font-black text-emerald-800 font-mono block mt-0.5">
                    94%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[10px] text-indigo-700 font-mono block uppercase font-bold">Recovery Probability</span>
                  <span className="text-sm font-black text-indigo-800 font-mono block mt-0.5">
                    87%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 text-white border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono block uppercase font-bold">Expected Recovery</span>
                  <span className="text-sm font-black text-emerald-400 font-mono block mt-0.5">
                    ₹4,350
                  </span>
                </div>
              </div>

              {/* Empirical Telemetry Evidence */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Telemetry Evidence Synthesized by Gemini</span>
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-amber-500 font-bold">📉</span>
                    <span><strong>Bank success rate dropped 31%:</strong> HDFC issuer node dropped from 99.2% to 69% in the last 15 minutes.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-indigo-500 font-bold">📊</span>
                    <span><strong>17 similar failures:</strong> Clustered failure signature matched 17 simultaneous timeout events on the same gateway rail.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-purple-500 font-bold">🔀</span>
                    <span><strong>Same payment route:</strong> UPI intent flow routed through HDFC VPA handle.</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-emerald-500 font-bold">👤</span>
                    <span><strong>Customer retry count = 0:</strong> Amit Sharma has not attempted any retries, indicating genuine intent without retry fatigue.</span>
                  </div>
                </div>
              </div>

              {/* AI Reasoning Summary */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-1.5">
                <span className="font-bold font-mono uppercase text-[11px] text-indigo-700 block">
                  Gemini Diagnostic Reasoning
                </span>
                <p className="leading-relaxed text-slate-700">
                  "The telemetry exhibits classic clustered transient latency rather than a hard account rejection or insufficient balance. Because the customer's intent is intact (0 retries) and HDFC rails typically recover within 8-12 minutes, the recovery probability is exceptionally high (87%)."
                </p>
              </div>
            </div>
          )}

          {/* STEP 03 DRILL DOWN */}
          {stepNumber === 3 && (
            <div className="space-y-5">
              <p className="text-xs text-slate-600">
                ReviveAI evaluated multiple candidate interventions to determine the highest expected yield while minimizing customer friction:
              </p>

              {/* Candidate Strategies Grid */}
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">1. Retry Now</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Immediate re-execution on degraded rail</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-700">42% probability</span>
                    <span className="text-[11px] text-slate-400 block font-mono">Expected: ₹2,100</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">2. Delayed Retry</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Automated server-side retry after 15m</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-700">81% probability</span>
                    <span className="text-[11px] text-slate-400 block font-mono">Expected: ₹4,050</span>
                  </div>
                </div>

                {/* Highlighted Selected Strategy */}
                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-xs shadow-sm relative">
                  <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded absolute top-2 right-2 font-mono">
                    ✓ SELECTED
                  </span>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">📱</span>
                        <span className="font-black text-emerald-950 text-sm">3. WhatsApp Recovery</span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-1 max-w-md leading-relaxed">
                        Interactive 1-click tokenized recovery message sent once bank degradation normalizes.
                      </p>
                    </div>
                    <div className="text-right shrink-0 mr-16">
                      <span className="font-black text-emerald-800 font-mono text-base">87%</span>
                      <span className="text-xs text-emerald-700 block font-bold font-mono">
                        Expected: ₹4,350
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">4. Email Recovery</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Standard payment link via inbox</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-700">38% probability</span>
                    <span className="text-[11px] text-slate-400 block font-mono">Expected: ₹1,900</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs opacity-75">
                  <div>
                    <span className="font-bold text-slate-600">5. STOP</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Halt to prevent friction (Used only if probability &lt;30%)</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-500">0% yield</span>
                    <span className="text-[11px] text-slate-400 block font-mono">Preserves reputation</span>
                  </div>
                </div>
              </div>

              {/* Selection Explanation */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-slate-800 space-y-1">
                <span className="font-bold font-mono text-indigo-900 uppercase text-[11px]">
                  Why WhatsApp Recovery Was Selected
                </span>
                <p className="leading-relaxed text-slate-700">
                  WhatsApp delivers an 87% expected recovery rate and a ₹4,350 expected return by giving the customer immediate 1-click re-authorization without having to re-enter card or billing details.
                </p>
              </div>
            </div>
          )}

          {/* STEP 04 DRILL DOWN */}
          {stepNumber === 4 && (
            <div className="space-y-5">
              {/* Architecture Principle Callout */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-mono font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>DUAL-ENGINE ARCHITECTURE</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  "Gemini recommends. Policy engine decides whether execution is allowed."
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  AI outputs probabilistic predictions, but our zero-trust deterministic policy layer strictly enforces safety guardrails before any customer communication occurs.
                </p>
              </div>

              {/* Deterministic Policy Check List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Deterministic Rule Evaluations
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ Amount limit verified (₹5,000 ≤ ₹25,000 auto-tier)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      PASSED
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ Recovery probability threshold (87% ≥ 30% minimum)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      PASSED
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ Retry limit safe (0/1 used today)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      PASSED
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ Customer contact limit checked (0/2 notifications today)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      PASSED
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>✓ Duplicate prevention enforced (No active duplicate sessions)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      PASSED
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Result Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="text-xs font-black tracking-wider uppercase font-mono">
                    RESULT: ACTION APPROVED
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800">
                  5/5 Guardrails Cleared
                </span>
              </div>
            </div>
          )}

          {/* STEP 05 DRILL DOWN */}
          {stepNumber === 5 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Verified interactive channel simulation:
                </span>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800">
                  WhatsApp Sandbox Simulation
                </span>
              </div>

              {/* Live WhatsApp Mock in Modal */}
              <div className="rounded-2xl border border-slate-300 overflow-hidden shadow-md">
                <div className="bg-[#075E54] text-white px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
                      RA
                    </div>
                    <span className="font-bold">ReviveAI Business</span>
                    <span className="text-[10px] bg-emerald-500/40 text-emerald-100 px-1.5 py-0.2 rounded font-mono">
                      Official
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80">+91 98765 43210</span>
                </div>

                <div className="p-4 bg-[#EFEAE2] space-y-3 min-h-[220px]">
                  <div className="bg-white rounded-xl rounded-tl-none p-3.5 shadow-xs border border-slate-200/70 max-w-sm space-y-2 text-xs">
                    <p className="font-semibold text-slate-900">Hi Amit 👋</p>
                    <p className="text-slate-700">
                      Your <span className="font-bold text-slate-900">₹5,000</span> payment couldn't be completed because of a temporary bank issue. The issue is now resolved.
                    </p>
                    <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] flex justify-between font-mono">
                      <span>Sony Headphones</span>
                      <span className="font-bold">₹5,000</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-600 text-white font-bold text-center text-xs">
                      ✓ Paid via UPI (₹5,000)
                    </div>
                    <div className="text-[10px] text-slate-400 text-right font-mono flex items-center justify-end gap-1">
                      <span>10:42 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery & Engagement Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="text-[10px] text-emerald-700 font-mono block">Status</span>
                  <span className="font-bold">Sent ✓</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="text-[10px] text-emerald-700 font-mono block">Delivery</span>
                  <span className="font-bold">Delivered ✓</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="text-[10px] text-emerald-700 font-mono block">Engagement</span>
                  <span className="font-bold">Read ✓</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="text-[10px] text-emerald-700 font-mono block">Customer Action</span>
                  <span className="font-bold">Clicked Link ✓</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 06 DRILL DOWN */}
          {stepNumber === 6 && (
            <div className="space-y-5">
              {/* Comparison Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Original Failed</span>
                  <span className="text-base font-black text-slate-700 font-mono">₹5,000</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 uppercase font-mono block">Recovered Amount</span>
                  <span className="text-base font-black text-emerald-700 font-mono">₹5,000</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <span className="text-[10px] text-emerald-100 uppercase font-mono block">Status</span>
                  <span className="text-base font-black font-mono">SUCCESS</span>
                </div>
              </div>

              {/* Webhook Verification Steps */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                  Cryptographic Webhook Verification
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Payment received via official UPI webhook</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Captured
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Amount matched exactly (₹5,000 = ₹5,000)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Matched
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Original failed payment linked (#pay_92831 → #REC-92831)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Linked
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Transaction verified with SHA256 HMAC signature</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 07 DRILL DOWN */}
          {stepNumber === 7 && (
            <div className="space-y-5">
              {/* Hero Recovered Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-200">
                    Final Verified Outcome
                  </span>
                  <span className="text-xs font-black bg-white/20 text-white px-2.5 py-1 rounded-full font-mono">
                    STATUS: SUCCESS
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black font-mono tracking-tight text-white">
                    ₹5,000
                  </span>
                  <span className="text-sm font-bold uppercase tracking-widest text-emerald-200">
                    RECOVERED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-500/50 text-xs">
                  <div>
                    <span className="text-emerald-200 text-[10px] block">Recovery Method:</span>
                    <span className="font-bold text-white">WhatsApp Recovery</span>
                  </div>
                  <div>
                    <span className="text-emerald-200 text-[10px] block">Recovery Time:</span>
                    <span className="font-bold text-white font-mono">10m 04s</span>
                  </div>
                  <div>
                    <span className="text-emerald-200 text-[10px] block">Original Failure:</span>
                    <span className="font-bold text-white font-mono">BANK_TIMEOUT</span>
                  </div>
                </div>
              </div>

              {/* Settlement Confirmation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="font-bold text-slate-900 uppercase font-mono text-[11px]">
                  Merchant Ledger Status
                </div>
                <p className="leading-relaxed">
                  ✓ ₹5,000 has been credited to merchant settlement balance. Customer order #ORD-92831 is marked <strong>FULFILLED</strong> and dispatched to delivery queue.
                </p>
              </div>

              {/* Direct Link to Audit Trail */}
              <button
                id="modal-view-audit-trail-btn"
                onClick={() => {
                  onClose();
                  onNavigate('audit-trail');
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <History className="w-4 h-4 text-emerald-400" />
                <span>View Full Immutable Audit Trail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Step 0{stepNumber} of 07</span>
            <span>•</span>
            <span className="text-emerald-600 font-bold">ReviveAI OS</span>
          </div>

          <div className="flex items-center gap-2">
            {stepNumber === 1 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('revenue-at-risk');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Revenue at Risk</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {stepNumber === 2 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('recovery-opportunities');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Opportunities</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {stepNumber === 3 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('recovery-strategies');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Strategies</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {stepNumber === 4 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('approvals');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Approvals</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {stepNumber === 6 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('active-recoveries');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Active Recoveries</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {stepNumber === 7 && (
              <button
                onClick={() => {
                  onClose();
                  onNavigate('audit-trail');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Audit Trail</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
