import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Zap,
  X,
  ChevronRight,
  Check,
  Building2,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

export type CheckoutMode = 'initial' | 'recovery';

interface FullscreenCheckoutModalProps {
  isOpen: boolean;
  mode: CheckoutMode;
  onClose: () => void;
  onFailInitial: (code: string, description: string) => void;
  onPayRecovery: () => void;
  onLaunchRazorpaySDK: () => void;
}

export const FullscreenCheckoutModal: React.FC<FullscreenCheckoutModalProps> = ({
  isOpen,
  mode,
  onClose,
  onFailInitial,
  onPayRecovery,
  onLaunchRazorpaySDK,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('gpay');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transitionStatus, setTransitionStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulateInitialFailure = () => {
    setIsProcessing(true);
    setTransitionStatus('Simulating UPI Bank Gateway Timeout (BANK_TIMEOUT)...');
    setTimeout(() => {
      setTransitionStatus('❌ Payment Failed — Transferring telemetry to ReviveAI Autonomous Engine...');
      setTimeout(() => {
        setIsProcessing(false);
        setTransitionStatus(null);
        onFailInitial('BANK_TIMEOUT', 'Temporary Bank Gateway Timeout');
      }, 1000);
    }, 800);
  };

  const handleCompleteRecoveryPayment = () => {
    setIsProcessing(true);
    setTransitionStatus('Authorizing UPI payment via ICICI Switch Rail...');
    setTimeout(() => {
      setTransitionStatus('✓ Payment Authorized by Bank! Webhook signature verified.');
      setTimeout(() => {
        setIsProcessing(false);
        setTransitionStatus(null);
        onPayRecovery();
      }, 900);
    }, 900);
  };

  return (
    <div
      id="fullscreen-checkout-overlay"
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col font-['Plus_Jakarta_Sans',sans-serif] text-slate-900 overflow-y-auto animate-fadeIn"
    >
      {/* ── Top Fintech Breadcrumb Navigation Bar ────────────────────────────── */}
      <div className="bg-[#1C1F2E] border-b border-slate-800 text-white px-6 py-3.5 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-black italic text-white shadow-md shadow-indigo-500/30">
            R
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-tight text-slate-300">
              <span className="text-slate-400">ReviveAI OS</span>
              <span>/</span>
              <span className="text-indigo-400">Recovery Control</span>
              <span>→</span>
              <span className="text-emerald-400">
                {mode === 'initial' ? 'Initial Checkout Mode' : 'WhatsApp 1-Click Recovery Payment'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Dedicated Full-Screen Sandbox Simulation • Order #ORD-92831
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Razorpay Buildathon Sandbox
          </span>

          <button
            onClick={onClose}
            title="Close Checkout Sandbox"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Transition Status Bar (Shown during payment state changes) ─────────── */}
      {transitionStatus && (
        <div className="bg-indigo-600 text-white px-6 py-2 text-xs font-mono font-bold text-center flex items-center justify-center gap-2 animate-fadeIn shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{transitionStatus}</span>
        </div>
      )}

      {/* ── Main Centered Checkout Body ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 my-auto">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Merchant & Sandbox Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-[#1C1F2E] to-slate-900 text-white p-6 border-b border-slate-800 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white tracking-tight">ReviveAI Store</h3>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Verified Merchant
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    Order #ORD-92831 • Noise-Cancelling Headphones
                  </p>
                </div>
              </div>

              {/* Total Amount Badge */}
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Total Amount</span>
                <span className="text-2xl font-black text-white font-mono tracking-tight">₹5,000.00</span>
              </div>
            </div>

            {mode === 'recovery' && (
              <div className="mt-4 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 font-medium">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  1-Click Recovery Payment Link generated by ReviveAI for failed Order #ORD-92831.
                </span>
              </div>
            )}
          </div>

          {/* Checkout Body Content */}
          <div className="p-6 space-y-6">
            {/* Customer Details Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs font-mono">
                  AS
                </div>
                <div>
                  <p className="font-bold text-slate-900">Amit Sharma</p>
                  <p className="text-slate-500 font-mono text-[11px]">amit.sharma@gmail.com • +91 98765 43210</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                Customer Profile
              </span>
            </div>

            {/* Payment Method Tabs */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono block">
                Select Payment Method
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('upi')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    selectedMethod === 'upi'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-sm ring-1 ring-indigo-600/30'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>UPI Instant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    selectedMethod === 'card'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-sm ring-1 ring-indigo-600/30'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('netbanking')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    selectedMethod === 'netbanking'
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-sm ring-1 ring-indigo-600/30'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>NetBanking</span>
                </button>
              </div>
            </div>

            {/* Method Details */}
            {selectedMethod === 'upi' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Choose UPI Application:</span>
                  {mode === 'recovery' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                      ICICI Auto-Switch Enabled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                  {[
                    { id: 'gpay', label: 'Google Pay' },
                    { id: 'phonepe', label: 'PhonePe' },
                    { id: 'paytm', label: 'Paytm' },
                    { id: 'bhim', label: 'BHIM UPI' },
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedUpiApp(app.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        selectedUpiApp === app.id
                          ? 'bg-white border-indigo-600 text-indigo-900 shadow-xs font-bold ring-1 ring-indigo-500/20'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {app.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons depending on Mode */}
            <div className="space-y-3 pt-2">
              {mode === 'initial' ? (
                <>
                  {/* Primary Demo Button: Simulate Failure */}
                  <button
                    disabled={isProcessing}
                    onClick={handleSimulateInitialFailure}
                    className="w-full py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                    )}
                    <span>Simulate Payment Failure (Trigger Recovery)</span>
                  </button>

                  {/* Secondary Option: Launch real Razorpay SDK modal */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      onClose();
                      onLaunchRazorpaySDK();
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-all cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                    <span>Launch Razorpay SDK Popup Frame</span>
                  </button>
                </>
              ) : (
                /* Recovery Pay Button */
                <button
                  disabled={isProcessing}
                  onClick={handleCompleteRecoveryPayment}
                  className="w-full py-3.5 px-5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Complete Recovery Payment ₹5,000</span>
                </button>
              )}
            </div>

            {/* Security Indicator Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Lock className="w-3 h-3 text-emerald-600" />
                256-Bit SSL Encrypted
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                PCI-DSS Level 1 Compliant
              </span>
              <span className="hidden sm:inline text-slate-400">Powered by Razorpay & ReviveAI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
