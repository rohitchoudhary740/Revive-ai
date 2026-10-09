import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  FileCheck2,
} from 'lucide-react';
import { BatchEvaluationRun, EvaluationSyntheticCase } from '../../types';

const formatCurrency = (val: number): string => {
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export const RecoveryEvaluationSection: React.FC = () => {
  const [data, setData] = useState<BatchEvaluationRun | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(42);
  const [batchSize, setBatchSize] = useState<number>(500);
  const [showCases, setShowCases] = useState<boolean>(false);
  const [caseFilter, setCaseFilter] = useState<'all' | 'recovered' | 'stopped' | 'human_review'>('all');

  // Staged progress telemetry
  const [evalProgress, setEvalProgress] = useState<number>(0);
  const [evalStage, setEvalStage] = useState<string>('');
  const [evalProcessedCount, setEvalProcessedCount] = useState<number>(0);
  const [evalDuration, setEvalDuration] = useState<number | null>(null);
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);
  const timerRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluation/results');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      if (json.run) {
        setData(json.run);
        setSeed(json.run.seed);
        setBatchSize(json.run.batchSize);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load batch evaluation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleRunEvaluation = async (customSeed?: number, customBatch?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(true);
    setEvalProgress(5);
    setEvalProcessedCount(0);
    setError(null);
    const targetSeed = typeof customSeed === 'number' ? customSeed : seed;
    const targetBatch = typeof customBatch === 'number' ? customBatch : batchSize;
    setEvalStage(`Phase 1/3: Ingesting ${targetBatch} synthetic cases (Mulberry32 PRNG seed #${targetSeed})...`);

    const startTime = performance.now();

    try {
      const apiPromise = fetch('/api/evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: targetSeed,
          batchSize: targetBatch,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Evaluation failed with status ${res.status}`);
        return (await res.json()) as BatchEvaluationRun;
      });

      const totalSteps = 24;
      let step = 0;

      await new Promise<void>((resolve) => {
        timerRef.current = setInterval(() => {
          step++;
          const progressPercent = Math.min(96, Math.round((step / totalSteps) * 100));
          const caseCount = Math.min(targetBatch, Math.round((step / totalSteps) * targetBatch));
          setEvalProgress(progressPercent);
          setEvalProcessedCount(caseCount);

          if (progressPercent < 35) {
            setEvalStage(`Phase 1/3: Generating ${targetBatch} deterministic synthetic cases (Seed #${targetSeed})...`);
          } else if (progressPercent < 70) {
            setEvalStage(`Phase 2/3: Simulating naive retry baseline vs ReviveAI policy-gated recovery...`);
          } else {
            setEvalStage(`Phase 3/3: Computing lift metrics, false recovery rates & net recovered revenue...`);
          }

          if (step >= totalSteps) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            resolve();
          }
        }, 50);
      });

      const result = await apiPromise;
      const elapsed = Number(((performance.now() - startTime) / 1000).toFixed(2));
      setData(result);
      setEvalProgress(100);
      setEvalProcessedCount(targetBatch);
      setEvalStage(`Evaluation Complete: ${targetBatch} cases analyzed in ${elapsed}s (Seed #${targetSeed})`);
      setEvalDuration(elapsed);
      setJustEvaluated(true);
      setTimeout(() => setJustEvaluated(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to run batch evaluation');
    } finally {
      setRunning(false);
    }
  };

  const handleResetDefault = () => {
    setSeed(42);
    setBatchSize(500);
    handleRunEvaluation(42, 500);
  };

  const filteredCases = (data?.sampleCases || []).filter((c) => {
    if (caseFilter === 'recovered') return c.reviveAi.recovered;
    if (caseFilter === 'stopped') return c.reviveAi.isStopped;
    if (caseFilter === 'human_review') return c.reviveAi.requiresHumanApproval;
    return true;
  });

  return (
    <div
      className="bg-white rounded-2xl border border-indigo-200/90 shadow-sm p-6 relative overflow-hidden space-y-6"
      id="recovery-evaluation-section"
    >
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Batch Recovery Evaluation Engine
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100/70 text-indigo-700 border border-indigo-200">
              Track 03 • Measured Recovery
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
              <FileCheck2 className="w-3 h-3" /> SYNTHETIC / SIMULATED
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Evaluates measured money recovered across a reproducible batch of{' '}
            <span className="font-mono font-semibold text-slate-700">{data?.batchSize || batchSize}</span> failed payment cases.
            Compares ReviveAI’s policy-gated recovery against a naive baseline strategy.
          </p>

          {/* Mandatory Requirement Statement */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Batch evaluation uses reproducible synthetic data and does not represent live merchant revenue.</span>
          </div>
        </div>

        {/* ── Deterministic Run Controls ───────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">Seed</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              disabled={running}
              className="w-14 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 text-center focus:outline-indigo-500"
              title="Deterministic random seed"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">Batch</span>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={running}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 focus:outline-indigo-500"
            >
              <option value={500}>500 cases</option>
              <option value={1000}>1,000 cases</option>
              <option value={1500}>1,500 cases</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleRunEvaluation()}
            disabled={running}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition-all ${
              running ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {running ? 'Simulating Batch...' : 'Run Evaluation'}
          </button>

          <button
            type="button"
            onClick={handleResetDefault}
            disabled={running}
            title="Reset to default seed 42"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchResults} className="ml-auto underline font-bold">
            Retry
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <p className="text-xs font-medium">Loading evaluation engine results...</p>
        </div>
      )}

      {/* ── Active Evaluation Progress Bar Pipeline ────────────────── */}
      {running && (
        <div className="p-4 rounded-xl bg-indigo-900 text-white shadow-md border border-indigo-700 space-y-2.5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="font-bold uppercase tracking-wider text-indigo-200">
                Executing Batch Evaluation Pipeline
              </span>
            </div>
            <div className="font-bold text-indigo-300 flex items-center gap-2">
              <span>{evalProcessedCount} / {batchSize} Cases</span>
              <span className="px-2 py-0.5 rounded bg-indigo-800 text-white text-[11px]">
                {evalProgress}%
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-indigo-950 rounded-full overflow-hidden border border-indigo-700/50">
            <div
              className="h-full bg-linear-to-r from-indigo-400 via-emerald-400 to-indigo-300 rounded-full transition-all duration-75"
              style={{ width: `${evalProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-indigo-200 font-mono">
            <span className="truncate pr-2">{evalStage}</span>
            <span className="shrink-0 text-slate-400">Mulberry32 PRNG #{seed}</span>
          </div>
        </div>
      )}

      {/* ── Completed Telemetry Pill ─────────────────────────────── */}
      {!running && evalDuration !== null && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs shadow-2xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Evaluation Complete:</strong> {data?.batchSize || batchSize} cases evaluated in{' '}
              <span className="font-bold text-emerald-700">{evalDuration}s</span> (Mulberry32 Seed #{data?.seed || seed}).
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
            Deterministic & Reproducible
          </span>
        </div>
      )}

      {data && (
        <>
          {/* ── Incremental Recovery Lift Highlight Cards ───────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Incremental Recovery Lift
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Run: {data.runId} (Seed {data.seed})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Incremental Recovered Revenue */}
              <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 rounded-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Incremental Recovered Revenue
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-emerald-950 font-mono">
                    +{formatCurrency(data.lift.recoveredRevenueLift)}
                  </p>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full font-mono">
                    +{data.lift.revenueLiftPercent}%
                  </span>
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-1">
                  Additional money recovered over naive baseline
                </p>
              </div>

              {/* Recovery Rate Lift */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/40 border border-indigo-200/80 rounded-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                  Recovery Rate Lift
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-indigo-950 font-mono">
                    +{data.lift.recoveryRateLiftPercentPoints.toFixed(1)}%
                  </p>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full font-mono">
                    pts lift
                  </span>
                </div>
                <p className="text-[10px] text-indigo-700/80 mt-1">
                  {data.reviveAi.recoveryRatePercent}% ReviveAI vs {data.baseline.recoveryRatePercent}% Baseline
                </p>
              </div>

              {/* Unnecessary Interventions Eliminated */}
              <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/40 border border-blue-200/80 rounded-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                  Wasted Interventions Stopped
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-blue-950 font-mono">
                    {data.lift.unnecessaryInterventionsReduced}
                  </p>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full font-mono">
                    cases spared
                  </span>
                </div>
                <p className="text-[10px] text-blue-700/80 mt-1">
                  Policy prevented spamming unrecoverable/fraud cases
                </p>
              </div>

              {/* Policy Blocked Value */}
              <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-200/80 rounded-xl p-4 shadow-2xs">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  Policy Guardrail Protected
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-amber-950 font-mono">
                    {formatCurrency(data.reviveAi.policyBlockedValue)}
                  </p>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-mono">
                    {data.reviveAi.stoppedCases} stopped
                  </span>
                </div>
                <p className="text-[10px] text-amber-700/80 mt-1">
                  Blocked from retry loops and fraud exposure
                </p>
              </div>
            </div>
          </div>

          {/* ── Side-by-Side Comparison: Naive Baseline | ReviveAI ── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Strategy Performance Comparison (Batch: {data.batchSize})
                </h4>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Deterministic Seed: <strong className="font-mono text-slate-800">{data.seed}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-4 font-semibold">Metric</th>
                    <th className="py-2.5 px-4 text-slate-700">Naive Baseline</th>
                    <th className="py-2.5 px-4 text-indigo-700 bg-indigo-50/50 font-bold">ReviveAI Strategy</th>
                    <th className="py-2.5 px-4 text-slate-900 font-bold">Delta / Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {/* Revenue at Risk */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Revenue at Risk</td>
                    <td className="py-2.5 px-4 text-slate-600">{formatCurrency(data.baseline.totalRevenueAtRisk)}</td>
                    <td className="py-2.5 px-4 text-indigo-900 bg-indigo-50/30 font-bold">
                      {formatCurrency(data.reviveAi.totalRevenueAtRisk)}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-500 text-[11px]">Identical test population</td>
                  </tr>

                  {/* Interventions Attempted */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Interventions</td>
                    <td className="py-2.5 px-4 text-slate-600">{data.baseline.interventionsAttempted}</td>
                    <td className="py-2.5 px-4 text-indigo-900 bg-indigo-50/30 font-bold">
                      {data.reviveAi.interventionsAttempted}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-600 text-[11px]">
                      {data.baseline.interventionsAttempted - data.reviveAi.interventionsAttempted > 0
                        ? `${data.baseline.interventionsAttempted - data.reviveAi.interventionsAttempted} fewer unneeded interventions`
                        : 'Calibrated dispatch'}
                    </td>
                  </tr>

                  {/* Successful Recoveries */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Successful Recoveries</td>
                    <td className="py-2.5 px-4 text-slate-600">{data.baseline.successfulRecoveries}</td>
                    <td className="py-2.5 px-4 text-emerald-700 bg-indigo-50/30 font-bold">
                      {data.reviveAi.successfulRecoveries}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-700 font-bold">
                      +{data.reviveAi.successfulRecoveries - data.baseline.successfulRecoveries} recoveries
                    </td>
                  </tr>

                  {/* Recovered Revenue */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-emerald-50/20 font-semibold">
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-900">Recovered Revenue</td>
                    <td className="py-2.5 px-4 text-slate-700">{formatCurrency(data.baseline.recoveredRevenue)}</td>
                    <td className="py-2.5 px-4 text-emerald-700 bg-indigo-50/40 font-bold text-sm">
                      {formatCurrency(data.reviveAi.recoveredRevenue)}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-700 font-bold text-sm">
                      +{formatCurrency(data.lift.recoveredRevenueLift)} (+{data.lift.revenueLiftPercent}%)
                    </td>
                  </tr>

                  {/* Recovery Rate */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Recovery Rate</td>
                    <td className="py-2.5 px-4 text-slate-600">{data.baseline.recoveryRatePercent}%</td>
                    <td className="py-2.5 px-4 text-indigo-900 bg-indigo-50/30 font-bold">
                      {data.reviveAi.recoveryRatePercent}%
                    </td>
                    <td className="py-2.5 px-4 text-indigo-700 font-bold">
                      +{data.lift.recoveryRateLiftPercentPoints.toFixed(1)}% lift
                    </td>
                  </tr>

                  {/* Human Review */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Human Review</td>
                    <td className="py-2.5 px-4 text-slate-400">0 (No guardrails)</td>
                    <td className="py-2.5 px-4 text-amber-700 bg-indigo-50/30 font-bold">
                      {data.reviveAi.humanReviewCases} cases
                    </td>
                    <td className="py-2.5 px-4 font-sans text-amber-700 text-[11px]">
                      High-value transactions held for safety
                    </td>
                  </tr>

                  {/* Stopped Cases */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Stopped Cases</td>
                    <td className="py-2.5 px-4 text-slate-400">0 (Blind retry)</td>
                    <td className="py-2.5 px-4 text-red-700 bg-indigo-50/30 font-bold">
                      {data.reviveAi.stoppedCases} cases
                    </td>
                    <td className="py-2.5 px-4 text-red-600 text-[11px]">
                      Halted to prevent fraud/exhausted retries
                    </td>
                  </tr>

                  {/* Unnecessary Interventions */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-700">Unnecessary Interventions</td>
                    <td className="py-2.5 px-4 text-red-600 font-bold">{data.baseline.unnecessaryInterventions}</td>
                    <td className="py-2.5 px-4 text-emerald-700 bg-indigo-50/30 font-bold">
                      {data.reviveAi.unnecessaryInterventions}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-700 font-bold">
                      -{data.lift.unnecessaryInterventionsReduced} wasted attempts eliminated
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Expandable Sample Cases Inspector ───────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCases(!showCases)}
              className="w-full bg-slate-50/70 hover:bg-slate-100/70 px-4 py-3 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  Inspect Sample Synthetic Cases ({data.sampleCases.length} displayed of {data.batchSize})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  SYNTHETIC / SIMULATED
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                <span>{showCases ? 'Hide' : 'Show Case Ledger'}</span>
                {showCases ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showCases && (
              <div className="p-4 space-y-3 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Filter:</span>
                  {(['all', 'recovered', 'stopped', 'human_review'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCaseFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all ${
                        caseFilter === f
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {f === 'all'
                        ? 'All Cases'
                        : f === 'recovered'
                        ? 'Recovered'
                        : f === 'stopped'
                        ? 'Policy Stopped'
                        : 'Human Review'}
                    </button>
                  ))}
                  <span className="text-[11px] text-slate-400 font-mono ml-auto">
                    Showing {filteredCases.length} cases
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Case ID</th>
                        <th className="py-2 px-3">Customer & Tier</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Failure Code</th>
                        <th className="py-2 px-3">Retries</th>
                        <th className="py-2 px-3">Ground Truth</th>
                        <th className="py-2 px-3">ReviveAI Policy</th>
                        <th className="py-2 px-3">Baseline</th>
                        <th className="py-2 px-3">ReviveAI Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredCases.map((c: EvaluationSyntheticCase) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-bold text-indigo-700">{c.id}</td>
                          <td className="py-2 px-3 font-sans">
                            <p className="font-semibold text-slate-800">{c.customerName}</p>
                            <span className="text-[9px] text-slate-400">{c.customerTier}</span>
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">{formatCurrency(c.amount)}</td>
                          <td className="py-2 px-3 font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                              {c.failureCode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">{c.retryCount}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                c.groundTruthRecoverable
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {(c.groundTruthProb * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            {c.reviveAi.isApproved && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {c.reviveAi.isStopped && (
                              <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[10px]">
                                <XCircle className="w-3 h-3" /> Stopped
                              </span>
                            )}
                            {c.reviveAi.requiresHumanApproval && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[10px]">
                                <Clock className="w-3 h-3" /> Human Review
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            {c.baseline.recovered ? (
                              <span className="text-emerald-600 font-bold text-[10px]">✓ Recovered</span>
                            ) : c.baseline.unnecessaryIntervention ? (
                              <span className="text-red-500 text-[10px]">✗ Wasted</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Failed</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            {c.reviveAi.recovered ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Recovered {formatCurrency(c.amount)}
                              </span>
                            ) : c.reviveAi.isStopped ? (
                              <span className="text-slate-500 text-[10px]">Protected</span>
                            ) : c.reviveAi.requiresHumanApproval ? (
                              <span className="text-amber-600 text-[10px]">Escalated</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Not Recovered</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
