import React, { useState, useEffect, useRef } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Loader2,
  Check,
  Activity,
  Zap,
  Sliders
} from 'lucide-react';
import {
  PolicyImpactSimulationResult,
  PolicyComparisonMetrics,
  PolicyImpactDeltas,
  PolicyTransitionCase,
  SafetyTradeOff
} from '../../types';

interface PolicyImpactSimulatorPanelProps {
  activeGuardrails: {
    maxAutoRecoveryAmount: number;
    minRecoveryProbability: number;
    maxAutomatedRetries: number;
    highValueRequiresApproval: boolean;
    lowConfidenceStops: boolean;
    agentMode: string;
  };
}

const formatCurrency = (val: number): string => {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

export const PolicyImpactSimulatorPanel: React.FC<PolicyImpactSimulatorPanelProps> = ({
  activeGuardrails,
}) => {
  const hasUserEditedRef = useRef<boolean>(false);
  const simTimerRef = useRef<any>(null);

  // Temporary simulated policy inputs
  const [simAmount, setSimAmount] = useState<number>(50000); // Default simulated: ₹50,000
  const [simMinProb, setSimMinProb] = useState<number>(30); // 30%
  const [simMaxRetries, setSimMaxRetries] = useState<number>(activeGuardrails.maxAutomatedRetries || 3);
  const [simHighValueApproval, setSimHighValueApproval] = useState<boolean>(activeGuardrails.highValueRequiresApproval ?? true);
  const [simLowConfidenceStops, setSimLowConfidenceStops] = useState<boolean>(activeGuardrails.lowConfidenceStops ?? true);
  const [simAgentMode, setSimAgentMode] = useState<string>(activeGuardrails.agentMode || 'auto_recover');
  const [simSeed, setSimSeed] = useState<number>(42);
  const [simBatchSize, setSimBatchSize] = useState<number>(500);

  // Simulation execution tracking
  const [simulationResult, setSimulationResult] = useState<PolicyImpactSimulationResult | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [simStage, setSimStage] = useState<string>('');
  const [simProcessedCount, setSimProcessedCount] = useState<number>(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [justSimulated, setJustSimulated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransitions, setShowTransitions] = useState<boolean>(false);

  // Snapshot of what was actually simulated
  const [lastSimulatedConfig, setLastSimulatedConfig] = useState<{
    amount: number;
    prob: number;
    retries: number;
    approval: boolean;
    stops: boolean;
    mode: string;
    seed: number;
    batchSize: number;
  } | null>(null);

  // Detect if user modified parameters since last simulation
  const hasPendingChanges = lastSimulatedConfig !== null && (
    simAmount !== lastSimulatedConfig.amount ||
    simMinProb !== lastSimulatedConfig.prob ||
    simMaxRetries !== lastSimulatedConfig.retries ||
    simHighValueApproval !== lastSimulatedConfig.approval ||
    simLowConfidenceStops !== lastSimulatedConfig.stops ||
    simAgentMode !== lastSimulatedConfig.mode ||
    simSeed !== lastSimulatedConfig.seed ||
    simBatchSize !== lastSimulatedConfig.batchSize
  );

  // Sync initial simulation values if active guardrails change and user hasn't edited
  useEffect(() => {
    if (hasUserEditedRef.current) return;
    const suggestedSimAmount = activeGuardrails.maxAutoRecoveryAmount === 25000 ? 50000 : activeGuardrails.maxAutoRecoveryAmount * 2;
    setSimAmount(suggestedSimAmount);
    setSimMinProb(Math.round(activeGuardrails.minRecoveryProbability * 100));
    setSimMaxRetries(activeGuardrails.maxAutomatedRetries);
    setSimHighValueApproval(activeGuardrails.highValueRequiresApproval);
    setSimLowConfidenceStops(activeGuardrails.lowConfidenceStops);
    setSimAgentMode(activeGuardrails.agentMode);
  }, [
    activeGuardrails.maxAutoRecoveryAmount,
    activeGuardrails.minRecoveryProbability,
    activeGuardrails.maxAutomatedRetries,
    activeGuardrails.highValueRequiresApproval,
    activeGuardrails.lowConfidenceStops,
    activeGuardrails.agentMode,
  ]);

  // Clean up any running simulation timers
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  /**
   * Executes the simulation with transparent, staged visual telemetry.
   * Runs the real API call in parallel while animating through the 4 analytical phases
   * so the merchant can see each case passing through the policy engine.
   */
  const runSimulation = async (customParams?: {
    amount?: number;
    prob?: number;
    retries?: number;
    approval?: boolean;
    stops?: boolean;
    mode?: string;
    seed?: number;
    batchSize?: number;
    immediate?: boolean;
  }) => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);

    const targetAmount = customParams?.amount ?? simAmount;
    const targetProb = customParams?.prob ?? simMinProb;
    const targetRetries = customParams?.retries ?? simMaxRetries;
    const targetApproval = customParams?.approval ?? simHighValueApproval;
    const targetStops = customParams?.stops ?? simLowConfidenceStops;
    const targetMode = customParams?.mode ?? simAgentMode;
    const targetSeed = customParams?.seed ?? simSeed;
    const targetBatch = customParams?.batchSize ?? simBatchSize;

    setSimulating(true);
    setSimProgress(5);
    setSimProcessedCount(0);
    setSimStage(`Phase 1/4: Synthesizing ${targetBatch} deterministic transactions (Seed #${targetSeed})...`);
    setError(null);

    const startTime = performance.now();

    const payload = {
      maxAutoRecoveryAmount: targetAmount,
      minRecoveryProbability: targetProb / 100,
      maxAutomatedRetries: targetRetries,
      highValueRequiresApproval: targetApproval,
      lowConfidenceStops: targetStops,
      agentMode: targetMode,
      seed: targetSeed,
      batchSize: targetBatch,
    };

    try {
      // 1. Kick off real backend simulation immediately
      const apiPromise = fetch('/api/guardrails/simulate-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Simulation failed: HTTP ${res.status}`);
        return (await res.json()) as PolicyImpactSimulationResult;
      });

      if (customParams?.immediate) {
        // Immediate mode (e.g. background initial mount)
        const data = await apiPromise;
        setSimulationResult(data);
        setLastSimulatedConfig({
          amount: targetAmount,
          prob: targetProb,
          retries: targetRetries,
          approval: targetApproval,
          stops: targetStops,
          mode: targetMode,
          seed: targetSeed,
          batchSize: targetBatch,
        });
        setSimulating(false);
        setSimProgress(100);
        return;
      }

      // 2. Multi-stage visual pipeline progression over ~1.25s
      const totalSteps = 24; // 24 ticks * 50ms = 1200ms
      let step = 0;

      await new Promise<void>((resolve, reject) => {
        simTimerRef.current = setInterval(() => {
          step++;
          const progressPercent = Math.min(96, Math.round((step / totalSteps) * 100));
          const caseCount = Math.min(targetBatch, Math.round((step / totalSteps) * targetBatch));

          setSimProgress(progressPercent);
          setSimProcessedCount(caseCount);

          if (progressPercent < 25) {
            setSimStage(`Phase 1/4: Synthesizing ${targetBatch} synthetic transactions (Mulberry32 seed #${targetSeed})...`);
          } else if (progressPercent < 55) {
            setSimStage(`Phase 2/4: Testing active baseline guardrails (₹${activeGuardrails.maxAutoRecoveryAmount.toLocaleString('en-IN')}, ${Math.round(activeGuardrails.minRecoveryProbability * 100)}% prob)...`);
          } else if (progressPercent < 85) {
            setSimStage(`Phase 3/4: Evaluating transactions against simulated rules (₹${targetAmount.toLocaleString('en-IN')}, ${targetProb}% prob)...`);
          } else {
            setSimStage(`Phase 4/4: Computing empirical delta shifts, velocity gains & safety trade-offs...`);
          }

          if (step >= totalSteps) {
            clearInterval(simTimerRef.current);
            simTimerRef.current = null;
            resolve();
          }
        }, 50);
      });

      // 3. Await API resolution and commit result
      const data = await apiPromise;
      const elapsedSeconds = Number(((performance.now() - startTime) / 1000).toFixed(2));

      setSimulationResult(data);
      setLastSimulatedConfig({
        amount: targetAmount,
        prob: targetProb,
        retries: targetRetries,
        approval: targetApproval,
        stops: targetStops,
        mode: targetMode,
        seed: targetSeed,
        batchSize: targetBatch,
      });
      setSimProgress(100);
      setSimProcessedCount(targetBatch);
      setSimStage(`Simulation Complete: ${targetBatch} cases evaluated in ${elapsedSeconds}s (Seed #${targetSeed})`);
      setLastDuration(elapsedSeconds);
      setJustSimulated(true);

      setTimeout(() => {
        setJustSimulated(false);
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to execute policy simulation');
    } finally {
      setSimulating(false);
    }
  };

  // Run initial simulation on mount with immediate mode
  useEffect(() => {
    runSimulation({ amount: 50000, immediate: true });
  }, []);

  const handleApplyPreset = (preset: 'expansion' | 'conservative' | 'aggressive' | 'reset') => {
    hasUserEditedRef.current = true;
    if (preset === 'expansion') {
      setSimAmount(50000);
      setSimMinProb(30);
      setSimHighValueApproval(true);
      setSimAgentMode('auto_recover');
      runSimulation({ amount: 50000, prob: 30, approval: true, mode: 'auto_recover' });
    } else if (preset === 'aggressive') {
      setSimAmount(75000);
      setSimMinProb(20);
      setSimHighValueApproval(false);
      setSimAgentMode('auto_recover');
      runSimulation({ amount: 75000, prob: 20, approval: false, mode: 'auto_recover' });
    } else if (preset === 'conservative') {
      setSimAmount(15000);
      setSimMinProb(50);
      setSimHighValueApproval(true);
      setSimAgentMode('review_first');
      runSimulation({ amount: 15000, prob: 50, approval: true, mode: 'review_first' });
    } else if (preset === 'reset') {
      hasUserEditedRef.current = false;
      setSimAmount(activeGuardrails.maxAutoRecoveryAmount);
      setSimMinProb(Math.round(activeGuardrails.minRecoveryProbability * 100));
      setSimMaxRetries(activeGuardrails.maxAutomatedRetries);
      setSimHighValueApproval(activeGuardrails.highValueRequiresApproval);
      setSimLowConfidenceStops(activeGuardrails.lowConfidenceStops);
      setSimAgentMode(activeGuardrails.agentMode);
      setSimSeed(42);
      setSimBatchSize(500);
      runSimulation({
        amount: activeGuardrails.maxAutoRecoveryAmount,
        prob: Math.round(activeGuardrails.minRecoveryProbability * 100),
        retries: activeGuardrails.maxAutomatedRetries,
        approval: activeGuardrails.highValueRequiresApproval,
        stops: activeGuardrails.lowConfidenceStops,
        mode: activeGuardrails.agentMode,
        seed: 42,
        batchSize: 500,
      });
    }
  };

  const deltas = simulationResult?.impactDeltas;
  const current = simulationResult?.currentPolicy;
  const sim = simulationResult?.simulatedPolicy;
  const tradeOff = simulationResult?.safetyTradeOff;
  const sampleTransitions = simulationResult?.sampleTransitionCases || [];

  return (
    <div id="policy-impact-simulator" className="mt-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-md overflow-hidden transition-all">
      {/* Top Banner: Strict Read-Only Disclaimer */}
      <div className="px-6 py-4 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <FlaskConical className={`w-5 h-5 ${simulating ? 'animate-bounce text-indigo-300' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white">Policy Impact Simulator</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                READ-ONLY SIMULATION
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Layer 4
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Simulate recovery yields, automation velocity, and risk trade-offs on {simBatchSize} cases before committing policy changes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>DOES NOT CHANGE ACTIVE POLICY</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 bg-[var(--bg-app)]/40">
        {/* Preset Quick Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] p-3.5 rounded-xl border border-[var(--border-app)] shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--text-primary)] font-mono uppercase flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Presets:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyPreset('expansion')}
                disabled={simulating}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                High-Ticket Expansion (₹50K)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('aggressive')}
                disabled={simulating}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                Maximum Velocity (₹75K, 20% Prob)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('conservative')}
                disabled={simulating}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                Strict Conservative (₹15K, Review First)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleApplyPreset('reset')}
            disabled={simulating}
            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-app)] text-[var(--text-secondary)] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Active Policy</span>
          </button>
        </div>

        {/* Temporary Simulated Guardrail Controls */}
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-app)]">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Configure Simulated Guardrail Parameters</h4>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Adjust temporary policy limits below and click <strong>"Run Simulation"</strong> to evaluate impact across {simBatchSize} cases.
              </p>
            </div>

            {/* Run Controls with Seed & Batch inputs */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
              <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] rounded-lg px-2 py-1 text-xs" title="Mulberry32 PRNG seed">
                <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)]">Seed</span>
                <input
                  type="number"
                  value={simSeed}
                  onChange={(e) => {
                    hasUserEditedRef.current = true;
                    setSimSeed(Number(e.target.value));
                  }}
                  disabled={simulating}
                  className="w-12 bg-[var(--bg-surface)] border border-[var(--border-app)] rounded px-1 py-0.5 text-xs font-mono font-bold text-[var(--text-primary)] text-center focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] rounded-lg px-2 py-1 text-xs">
                <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)]">Batch</span>
                <select
                  value={simBatchSize}
                  onChange={(e) => {
                    hasUserEditedRef.current = true;
                    setSimBatchSize(Number(e.target.value));
                  }}
                  disabled={simulating}
                  className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded px-1 py-0.5 text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-indigo-500 cursor-pointer"
                >
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={1500}>1,500</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => runSimulation()}
                disabled={simulating}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                  hasPendingChanges
                    ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300 ring-offset-1 animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
                }`}
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>
                  {simulating
                    ? 'Simulating Batch...'
                    : hasPendingChanges
                      ? 'Run Simulation (Pending Changes)'
                      : `Run Simulation (${simBatchSize} Cases)`}
                </span>
              </button>
            </div>
          </div>

          {/* Pending Changes Notice Banner */}
          {hasPendingChanges && !simulating && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Unsimulated Parameter Adjustments:</strong> Sliders have been modified. The metrics below currently reflect the previous run. Click <strong>"Run Simulation"</strong> to evaluate on {simBatchSize} cases.
                </span>
              </div>
              <button
                type="button"
                onClick={() => runSimulation()}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 shadow-xs cursor-pointer ml-2"
              >
                Evaluate Now
              </button>
            </div>
          )}

          {/* Slider Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Amount Slider */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-primary)]">Simulated Auto Limit</label>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">₹{simAmount.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min={5000}
                max={100000}
                step={5000}
                value={simAmount}
                disabled={simulating}
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  setSimAmount(Number(e.target.value));
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                <span>Active: ₹{activeGuardrails.maxAutoRecoveryAmount.toLocaleString('en-IN')}</span>
                <span>Max: ₹1,00,000</span>
              </div>
            </div>

            {/* Probability Slider */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-primary)]">Simulated Min Probability</label>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{simMinProb}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={simMinProb}
                disabled={simulating}
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  setSimMinProb(Number(e.target.value));
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                <span>Active: {Math.round(activeGuardrails.minRecoveryProbability * 100)}%</span>
                <span>Max: 80%</span>
              </div>
            </div>

            {/* Retries */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-primary)]">Simulated Max Retries</label>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{simMaxRetries} retries</span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={simMaxRetries}
                disabled={simulating}
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  setSimMaxRetries(Number(e.target.value));
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                <span>Active: {activeGuardrails.maxAutomatedRetries} retries</span>
                <span>Max: 6</span>
              </div>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">High-Value Approval</span>
                <span className="text-[10px] text-[var(--text-muted)]">Require review above limit</span>
              </div>
              <button
                type="button"
                disabled={simulating}
                onClick={() => {
                  hasUserEditedRef.current = true;
                  setSimHighValueApproval(!simHighValueApproval);
                }}
                className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${simHighValueApproval ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${simHighValueApproval ? 'translate-x-3.5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">Low-Confidence Stop</span>
                <span className="text-[10px] text-[var(--text-muted)]">Halt below min probability</span>
              </div>
              <button
                type="button"
                disabled={simulating}
                onClick={() => {
                  hasUserEditedRef.current = true;
                  setSimLowConfidenceStops(!simLowConfidenceStops);
                }}
                className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${simLowConfidenceStops ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${simLowConfidenceStops ? 'translate-x-3.5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">Simulated Agent Mode</span>
                <span className="text-[10px] text-[var(--text-muted)]">Autonomy tier</span>
              </div>
              <select
                value={simAgentMode}
                disabled={simulating}
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  setSimAgentMode(e.target.value);
                }}
                className="text-xs font-mono font-bold bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-lg px-2 py-1 text-[var(--text-primary)] cursor-pointer"
              >
                <option value="auto_recover">Auto Recover</option>
                <option value="review_first">Review First</option>
                <option value="manual_only">Manual Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── HIGH-PRECISION SIMULATION PROGRESS PIPELINE ───────────────── */}
        {simulating && (
          <div className="p-4.5 rounded-2xl bg-indigo-900 text-white shadow-lg border border-indigo-700 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="font-mono font-bold uppercase tracking-wider text-indigo-200">
                  Executing Closed-Loop Policy Evaluation
                </span>
              </div>
              <div className="font-mono font-bold text-indigo-300 flex items-center gap-2">
                <span>{simProcessedCount} / {simBatchSize} Cases</span>
                <span className="px-2 py-0.5 rounded bg-indigo-800 text-white text-[11px] font-bold">
                  {simProgress}%
                </span>
              </div>
            </div>

            {/* Visual Animated Progress Bar */}
            <div className="w-full h-2.5 bg-indigo-950/80 rounded-full overflow-hidden p-0.5 border border-indigo-700/50">
              <div
                className="h-full bg-linear-to-r from-indigo-400 via-emerald-400 to-indigo-300 rounded-full transition-all duration-75 shadow-sm"
                style={{ width: `${simProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-indigo-200 font-mono">
              <span className="truncate pr-2">{simStage}</span>
              <span className="shrink-0 text-slate-400">Mulberry32 PRNG #{simSeed}</span>
            </div>
          </div>
        )}

        {/* Completed Telemetry Pill */}
        {!simulating && lastDuration !== null && (
          <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-2xs font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Evaluation Complete:</strong> {simulationResult?.batchSize || simBatchSize} cases simulated in{' '}
                <span className="font-bold text-emerald-700">{lastDuration}s</span> (Mulberry32 Seed #{simulationResult?.seed || simSeed}).
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
              0 Active DB Mutations
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ── 4 CORE CALCULATED CHANGES (Hypothetical Simulated Impact) ────────────────── */}
        {deltas && current && sim && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
                Calculated Policy Impact Shifts (Hypothetical Outcomes)
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Empirically evaluated across {simulationResult?.batchSize || simBatchSize} cases
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Expected Recovery */}
              <div className={`p-4 rounded-xl bg-[var(--bg-surface)] border shadow-xs transition-all ${
                justSimulated ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-[var(--border-app)]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                    Expected Recovery
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    deltas.expectedRecovery >= 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {deltas.expectedRecovery >= 0 ? `+${formatCurrency(deltas.expectedRecovery)}` : formatCurrency(deltas.expectedRecovery)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black font-mono text-[var(--text-primary)]">
                    {formatCurrency(sim.expectedRecovery)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active policy: {formatCurrency(current.expectedRecovery)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)] leading-relaxed">
                  Projected revenue yield under simulated guardrail rules.
                </p>
              </div>

              {/* 2. Automatically Approved Cases */}
              <div className={`p-4 rounded-xl bg-[var(--bg-surface)] border shadow-xs transition-all ${
                justSimulated ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-[var(--border-app)]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                    Automatically Approved
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    deltas.autoRecoverCases >= 0
                      ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {deltas.autoRecoverCases >= 0 ? `+${deltas.autoRecoverCases}` : deltas.autoRecoverCases}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black font-mono text-[var(--text-primary)]">
                    {sim.autoRecoverCases} <span className="text-xs font-normal text-[var(--text-muted)]">cases</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active policy: {current.autoRecoverCases} cases
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)] leading-relaxed">
                  Cases eligible for instant zero-touch automated recovery.
                </p>
              </div>

              {/* 3. Human Reviews */}
              <div className={`p-4 rounded-xl bg-[var(--bg-surface)] border shadow-xs transition-all ${
                justSimulated ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-[var(--border-app)]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                    Human Reviews
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    deltas.humanReviewCases <= 0
                      ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {deltas.humanReviewCases >= 0 ? `+${deltas.humanReviewCases}` : deltas.humanReviewCases}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black font-mono text-[var(--text-primary)]">
                    {sim.humanReviewCases} <span className="text-xs font-normal text-[var(--text-muted)]">cases</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active policy: {current.humanReviewCases} cases
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)] leading-relaxed">
                  High-value or uncertain cases routed to Risk Approvals.
                </p>
              </div>

              {/* 4. Stopped Cases */}
              <div className={`p-4 rounded-xl bg-[var(--bg-surface)] border shadow-xs transition-all ${
                justSimulated ? 'border-slate-500 ring-2 ring-slate-500/20' : 'border-[var(--border-app)]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                    Stopped Cases
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-app)]">
                    {deltas.stoppedCases >= 0 ? `+${deltas.stoppedCases}` : deltas.stoppedCases}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black font-mono text-[var(--text-primary)]">
                    {sim.stoppedCases} <span className="text-xs font-normal text-[var(--text-muted)]">cases</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active policy: {current.stoppedCases} cases
                  </span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)] leading-relaxed">
                  Halted by low probability or max retries to protect merchant margins.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE CASE TRANSITION SAMPLE PREVIEW ────────────────────────── */}
        {sampleTransitions.length > 0 && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h5 className="text-xs font-bold text-[var(--text-primary)]">
                  Simulated Reclassification Stream ({sampleTransitions.length} sample transactions reclassified by policy change)
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowTransitions(!showTransitions)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{showTransitions ? 'Collapse Cases' : `View All (${sampleTransitions.length})`}</span>
                {showTransitions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* First 3 Shifted Case Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {sampleTransitions.slice(0, 3).map((tc) => (
                <div
                  key={tc.caseId}
                  className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-[var(--text-primary)]">{tc.caseId}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-sans">₹{tc.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span className="truncate max-w-[100px]">{tc.customerName}</span>
                    <span className="font-mono">{tc.failureCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border-subtle)] font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold">
                      {tc.before.status}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                      {tc.after.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Expandable full list */}
            {showTransitions && (
              <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)] max-h-72 overflow-y-auto">
                {sampleTransitions.map((tc) => (
                  <div key={tc.caseId} className="p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-[var(--text-primary)]">{tc.caseId}</span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{tc.amount.toLocaleString('en-IN')}</span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="text-[var(--text-secondary)]">{tc.customerName}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{tc.failureCode}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold">
                        {tc.before.status}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                        {tc.after.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPARISON TABLE: CURRENT POLICY vs SIMULATED POLICY */}
        {current && sim && deltas && (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[var(--bg-surface-elevated)] border-b border-[var(--border-app)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase font-mono tracking-wider">
                  CURRENT POLICY vs SIMULATED POLICY ({simulationResult?.batchSize || simBatchSize}-Case Evaluation Batch)
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Calculated deterministically using Mulberry32 PRNG seed #{simulationResult?.seed || simSeed}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                  HYPOTHETICAL · READ-ONLY
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-app)] shadow-2xs">
                  100% Empirically Calculated
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-surface-elevated)] text-[10px] font-mono uppercase text-[var(--text-muted)] border-b border-[var(--border-app)]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Policy Metric</th>
                    <th className="px-4 py-3 font-bold">CURRENT POLICY (Active)</th>
                    <th className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">SIMULATED POLICY (Hypothetical)</th>
                    <th className="px-4 py-3 font-bold text-right">Delta / Net Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono text-[var(--text-primary)]">
                  {/* Row 1: Expected Recovery */}
                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-3 font-sans font-bold text-[var(--text-primary)]">
                      Expected Recovery
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatCurrency(current.expectedRecovery)}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(sim.expectedRecovery)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {deltas.expectedRecovery >= 0 ? `+${formatCurrency(deltas.expectedRecovery)}` : formatCurrency(deltas.expectedRecovery)}
                    </td>
                  </tr>

                  {/* Row 2: Automatically Approved Cases */}
                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-3 font-sans font-bold text-[var(--text-primary)]">
                      Automatically Approved Cases
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{current.autoRecoverCases}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{sim.autoRecoverCases}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={deltas.autoRecoverCases >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {deltas.autoRecoverCases >= 0 ? `+${deltas.autoRecoverCases}` : deltas.autoRecoverCases}
                      </span>
                    </td>
                  </tr>

                  {/* Row 3: Human Reviews */}
                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-3 font-sans font-bold text-[var(--text-primary)]">
                      Human Reviews (Approvals Queue)
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{current.humanReviewCases}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{sim.humanReviewCases}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={deltas.humanReviewCases <= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}>
                        {deltas.humanReviewCases >= 0 ? `+${deltas.humanReviewCases}` : deltas.humanReviewCases}
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: Stopped Cases */}
                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-3 font-sans font-bold text-[var(--text-primary)]">
                      Stopped Cases (Guardrail Halt)
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{current.stoppedCases}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{sim.stoppedCases}</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--text-muted)]">
                      {deltas.stoppedCases >= 0 ? `+${deltas.stoppedCases}` : deltas.stoppedCases}
                    </td>
                  </tr>

                  {/* Secondary Metrics */}
                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-2.5 font-sans font-medium text-[var(--text-secondary)]">Interventions Attempted</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{current.interventions}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{sim.interventions}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {deltas.interventions >= 0 ? `+${deltas.interventions}` : deltas.interventions}
                    </td>
                  </tr>

                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 bg-emerald-500/5 transition-colors">
                    <td className="px-5 py-2.5 font-sans font-bold text-emerald-800 dark:text-emerald-300">Simulated Recovered Revenue</td>
                    <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrency(current.recoveredRevenue)}</td>
                    <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-300 font-black">{formatCurrency(sim.recoveredRevenue)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {deltas.recoveredRevenue >= 0 ? `+${formatCurrency(deltas.recoveredRevenue)}` : formatCurrency(deltas.recoveredRevenue)}
                    </td>
                  </tr>

                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-2.5 font-sans font-medium text-[var(--text-secondary)]">Policy-Blocked Revenue</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{formatCurrency(current.policyBlockedRevenue)}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{formatCurrency(sim.policyBlockedRevenue)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[var(--text-muted)]">
                      {deltas.policyBlockedRevenue >= 0 ? `+${formatCurrency(deltas.policyBlockedRevenue)}` : formatCurrency(deltas.policyBlockedRevenue)}
                    </td>
                  </tr>

                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-2.5 font-sans font-medium text-[var(--text-secondary)]">Recovery Rate (%)</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{current.recoveryRate}%</td>
                    <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{sim.recoveryRate}%</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {deltas.recoveryRate >= 0 ? `+${deltas.recoveryRate}%` : `${deltas.recoveryRate}%`}
                    </td>
                  </tr>

                  <tr className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors">
                    <td className="px-5 py-2.5 font-sans font-medium text-[var(--text-secondary)]">Unnecessary Interventions</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{current.unnecessaryInterventions}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{sim.unnecessaryInterventions}</td>
                    <td className="px-4 py-2.5 text-right font-bold">
                      <span className={deltas.unnecessaryInterventions <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {deltas.unnecessaryInterventions >= 0 ? `+${deltas.unnecessaryInterventions}` : deltas.unnecessaryInterventions}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Safety Trade-Off Callout */}
        {tradeOff && (
          <div className={`p-4.5 rounded-2xl border ${
            tradeOff.riskLevel === 'ELEVATED'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
              : tradeOff.riskLevel === 'BALANCED'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-950 dark:text-indigo-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-4 h-4 ${tradeOff.riskLevel === 'ELEVATED' ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span className="font-bold text-xs uppercase font-mono">
                  Safety Trade-Off Analysis: {tradeOff.riskLevel} EXPOSURE
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border-app)]">
                Automated Risk Sentinel
              </span>
            </div>

            <div className="mt-2.5 space-y-2 text-xs">
              <p className="font-semibold text-[var(--text-primary)]">{tradeOff.headline}</p>
              <ul className="space-y-1.5 text-[var(--text-secondary)]">
                {tradeOff.tradeOffPoints.map((pt, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] flex-wrap">
                <span className="font-bold uppercase text-indigo-600 dark:text-indigo-400">Recommended Safeguard:</span>
                <span>{tradeOff.recommendedSafeguard}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Invariant Assurance: Strict Read-Only Disclaimer */}
      <div className="px-6 py-3 bg-[var(--bg-surface-elevated)] border-t border-[var(--border-app)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 font-mono">
          <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            <strong>Hypothetical Simulation Invariant:</strong> Simulator models outcomes on sample data. It does not execute payments or mutate live policy.
          </span>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">Zero Mutation Guarantee · Read-Only Sandbox</span>
      </div>
    </div>
  );
};
