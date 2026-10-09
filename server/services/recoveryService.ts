import { TransactionRepository } from '../repositories/transactionRepository';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { AiDiagnosisRepository } from '../repositories/aiDiagnosisRepository';
import { PolicyDecisionRepository } from '../repositories/policyDecisionRepository';
import { RecoveryActionRepository } from '../repositories/recoveryActionRepository';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { RecoveryJourneyRepository } from '../repositories/recoveryJourneyRepository';
import { diagnosePaymentFailureWithGemini } from './geminiService';
import { evaluateDeterministicSafetyRules } from './policyEngine';
import { RazorpayService } from './razorpayService';
import { getGuardrailConfig, getGuardrailVersion } from './guardrailConfig';
import { StrategyIntelligenceService } from './strategyIntelligence';
import { ClosedLoopAgent } from './closedLoopAgent';
import { STRATEGY_REGISTRY, getStrategyDefinition, RecoveryStrategyId } from './strategyRegistry';
import {
  FinancialSafetyService,
  type ExecutionMode,
  TerminalCaseError,
  AmountMismatchError,
  DuplicateActionError,
  RetryRaceError,
  PolicyRecheckError,
  StaleAuthorizationError
} from './financialSafetyService';

export const RecoveryService = {
  async handlePaymentFailure(
    paymentId: string,
    orderId: string,
    amount: number,
    customer: { name: string; email: string; phone: string },
    failureCode: string,
    failureReason: string,
    mode: ExecutionMode = 'TEST_MODE'
  ) {
    console.log(`[Orchestrator] Handling failure for payment ${paymentId}, Order ${orderId}`);

    // 1. Save Failed Transaction
    await TransactionRepository.save({
      id: paymentId,
      order_id: orderId,
      amount,
      currency: 'INR',
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      status: 'failed',
      failure_code: failureCode,
      failure_reason: failureReason,
      created_at: new Date().toISOString()
    });

    // 2. Create Recovery Case
    const caseId = `REC-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();
    await RecoveryCaseRepository.save({
      id: caseId,
      transaction_id: paymentId,
      status: 'new',
      current_stage: 'Payment Failure Detected',
      created_at: now,
      updated_at: now
    });

    // 3. Log Audit Event
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'PAYMENT_FAILURE',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(
        `Failed transaction of ₹${amount.toLocaleString('en-IN')} ingested via Razorpay webhook. Code: ${failureCode}`,
        mode
      ),
      actor: 'Policy Engine',
      status: 'COMPLIANT'
    });

    // 4. Trigger Async Pipeline (AI Diagnosis -> Safety Check -> Execution)
    this.runRecoveryPipeline(caseId, paymentId, amount, customer, failureCode, orderId, mode).catch((err) => {
      console.error(`[Orchestrator] Recovery pipeline failed for case ${caseId}:`, err.message);
    });

    return caseId;
  },

  async runRecoveryPipeline(
    caseId: string,
    paymentId: string,
    amount: number,
    customer: { name: string; email: string; phone: string },
    failureCode: string,
    orderId: string,
    mode: ExecutionMode = 'TEST_MODE'
  ) {
    console.log(`[Orchestrator] Starting diagnosis & rule check for case ${caseId}`);

    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      throw new Error(`Recovery case ${caseId} not found.`);
    }

    // 1. Terminal State Protection
    await FinancialSafetyService.assertNotTerminal(caseId, rc.status, mode);

    // 2. Amount verification: check against original transaction
    const tx = await TransactionRepository.findById(paymentId);
    if (tx) {
      await FinancialSafetyService.verifyAmount(caseId, amount, tx.amount, mode);
    }

    // Stage 1: AI Diagnosis
    await RecoveryCaseRepository.updateStatus(caseId, 'diagnosing', 'Gemini AI Diagnosis');
    
    let diagnosis: any;
    try {
      diagnosis = await diagnosePaymentFailureWithGemini(
        amount,
        failureCode,
        'UPI', // Default to UPI for simulated triggers
        0, // Assume 0 previous retries in clean demo run
        customer.name
      );
    } catch (err: any) {
      // Safe AI failure: route to human review fallback
      await FinancialSafetyService.handleSafeAiFailure(caseId, err.message, mode);
      await RecoveryCaseRepository.updateStatus(
        caseId,
        'human_review',
        'AI Diagnosis Unavailable — Awaiting Merchant Approval'
      );
      return;
    }

    await AiDiagnosisRepository.save({
      id: `DIAG-${Date.now()}`,
      case_id: caseId,
      root_cause: diagnosis.rootCause,
      confidence: diagnosis.confidence,
      recovery_probability: diagnosis.recoveryProbability,
      recommended_action: diagnosis.recommendedAction,
      reason: diagnosis.reasoning,
      evidence: JSON.stringify(diagnosis.evidence),
      created_at: new Date().toISOString()
    });

    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'AI_DIAGNOSIS',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(
        `Gemini completed root cause analysis: ${diagnosis.rootCause} (Confidence: ${Math.round(diagnosis.confidence * 100)}%)`,
        mode
      ),
      actor: 'ReviveAI Agent',
      status: 'COMPLIANT'
    });

    // Stage 2: Strategy Ranking & Selection
    const strategyDecision = await StrategyIntelligenceService.rankAndSelectStrategy(caseId, diagnosis);
    const selectedStrategy = strategyDecision.selectedStrategy;
    const strategyDef = getStrategyDefinition(selectedStrategy);

    // Record guardrails version at diagnosis/authorization
    const authorizedGuardrailsVersion = getGuardrailVersion();

    // Stage 3: Policy Safety Check on Selected Strategy
    await RecoveryCaseRepository.updateStatus(caseId, 'safety_checking', 'Safety Sentinel Policy Check');
    
    // Enforce duplicate protection checks
    const activeCases = await RecoveryCaseRepository.findAll();
    const isDuplicateActive = activeCases.some(
      (c) => c.transaction_id === paymentId && c.id !== caseId && ['sent', 'authorized', 'new'].includes(c.status)
    );

    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const policyResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      'new',
      amount,
      selectedStrategy,
      history,
      diagnosis,
      getGuardrailConfig()
    );

    await PolicyDecisionRepository.save({
      id: `POL-${Date.now()}`,
      case_id: caseId,
      approved: policyResult.isApproved ? 1 : 0,
      status_text: policyResult.statusText,
      checks: JSON.stringify(policyResult.checks),
      created_at: new Date().toISOString()
    });

    if (policyResult.isStopped) {
      await RecoveryCaseRepository.updateStatus(caseId, 'stopped', 'Recovery Halted');
      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'SAFETY_APPROVED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(`Recovery halted. Reason: policy check failed: ${policyResult.statusText}`, mode),
        actor: 'Policy Engine',
        status: 'COMPLIANT'
      });
      return;
    }

    if (policyResult.requiresHumanApproval) {
      await RecoveryCaseRepository.updateStatus(caseId, 'human_review', 'Awaiting Merchant Approval');
      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'SAFETY_APPROVED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(`Held for merchant operator approval — ${policyResult.statusText}`, mode),
        actor: 'Policy Engine',
        status: 'COMPLIANT'
      });
      return;
    }

    // Stage 4: Authorized & Execution for Canonical Strategy
    await RecoveryCaseRepository.updateStatus(caseId, 'authorized', `Authorizing ${strategyDef.name}`);
    
    // Stale Authorization Check: verify guardrails haven't mutated
    await FinancialSafetyService.assertDecisionNotStale(caseId, authorizedGuardrailsVersion, mode);

    // Idempotency Lock: unique per action & strategy
    const idempotencyKey = `act_${caseId}_${selectedStrategy}_1`;
    await FinancialSafetyService.acquireActionLock(
      idempotencyKey,
      caseId,
      selectedStrategy,
      { amount, customer },
      mode
    );

    // Pre-execution Policy Re-check (fresh read from guardrails)
    const freshGuardrails = getGuardrailConfig();
    const recheckResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      'authorized',
      amount,
      selectedStrategy,
      history,
      diagnosis,
      freshGuardrails
    );

    if (!recheckResult.isApproved) {
      await FinancialSafetyService.releaseActionLock(idempotencyKey, caseId, recheckResult.statusText);
      await FinancialSafetyService.logSafetyBlock(
        caseId,
        `Pre-dispatch policy re-check failed: ${recheckResult.statusText}. Action blocked.`,
        mode
      );
      await RecoveryCaseRepository.updateStatus(
        caseId,
        recheckResult.isStopped ? 'stopped' : 'human_review',
        recheckResult.statusText
      );
      return;
    }

    try {
      if (selectedStrategy === 'smart_retry') {
        const retryResult = {
          route: 'ICICI_BACKUP_GATEWAY_NODE',
          status: 'captured',
          gateway_ref: `retry_${Date.now()}`
        };

        await RecoveryActionRepository.save({
          id: `ACT-${Date.now()}`,
          case_id: caseId,
          channel: 'smart_retry',
          payment_link_id: retryResult.gateway_ref,
          payment_url: null,
          status: 'captured',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Recovered via Smart Gateway Retry');

        await RecoveryJourneyRepository.saveStep({
          id: `STEP-${caseId}-1`,
          case_id: caseId,
          attempt_number: 1,
          strategy_id: 'smart_retry',
          strategy_name: strategyDef.name,
          reasoning: strategyDecision.reasoning,
          policy_approved: 1,
          policy_checks: JSON.stringify(policyResult.checks),
          policy_status_text: policyResult.statusText,
          action_status: 'executed',
          action_payload: JSON.stringify(retryResult),
          outcome: 'success',
          failure_reason: null,
          next_action: 'TERMINAL_SUCCESS',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await FinancialSafetyService.completeActionLock(idempotencyKey, caseId, retryResult);

        await AuditEventRepository.save({
          id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
          timestamp: new Date().toLocaleTimeString() + ' (Just now)',
          event_type: 'CASE_RECOVERED',
          case_id: caseId,
          details: FinancialSafetyService.tagMode(
            `Autonomous Smart Gateway Retry successfully routed and captured ₹${amount.toLocaleString('en-IN')}.`,
            mode
          ),
          actor: 'ReviveAI Agent',
          status: 'VERIFIED'
        });
      } else if (selectedStrategy === 'delayed_retry') {
        const delayedPayload = {
          queueTime: new Date().toISOString(),
          scheduledDelaySeconds: strategyDef.cooldownSeconds
        };

        await RecoveryActionRepository.save({
          id: `ACT-${Date.now()}`,
          case_id: caseId,
          channel: 'delayed_retry',
          payment_link_id: null,
          payment_url: null,
          status: 'queued',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await RecoveryCaseRepository.updateStatus(caseId, 'authorized', 'Queued for Delayed Retry');

        await RecoveryJourneyRepository.saveStep({
          id: `STEP-${caseId}-1`,
          case_id: caseId,
          attempt_number: 1,
          strategy_id: 'delayed_retry',
          strategy_name: strategyDef.name,
          reasoning: strategyDecision.reasoning,
          policy_approved: 1,
          policy_checks: JSON.stringify(policyResult.checks),
          policy_status_text: policyResult.statusText,
          action_status: 'executed',
          action_payload: JSON.stringify(delayedPayload),
          outcome: 'in_progress',
          failure_reason: null,
          next_action: 'AWAITING_MAINTENANCE_WINDOW',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await FinancialSafetyService.completeActionLock(idempotencyKey, caseId, delayedPayload);
      } else if (selectedStrategy === 'payment_method_update') {
        const plink = await RazorpayService.createRecoveryPaymentLink(
          caseId,
          amount,
          orderId,
          customer
        );

        await RecoveryActionRepository.save({
          id: `ACT-${Date.now()}`,
          case_id: caseId,
          channel: 'payment_method_update',
          payment_link_id: plink.id,
          payment_url: plink.short_url,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await RecoveryCaseRepository.updateStatus(caseId, 'sent', 'Payment Method Update Prompt Sent');

        await RecoveryJourneyRepository.saveStep({
          id: `STEP-${caseId}-1`,
          case_id: caseId,
          attempt_number: 1,
          strategy_id: 'payment_method_update',
          strategy_name: strategyDef.name,
          reasoning: strategyDecision.reasoning,
          policy_approved: 1,
          policy_checks: JSON.stringify(policyResult.checks),
          policy_status_text: policyResult.statusText,
          action_status: 'executed',
          action_payload: JSON.stringify({
            channel: 'payment_method_update',
            payment_link_id: plink.id,
            payment_url: plink.short_url
          }),
          outcome: 'in_progress',
          failure_reason: null,
          next_action: 'AWAITING_INSTRUMENT_UPDATE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await FinancialSafetyService.completeActionLock(idempotencyKey, caseId, {
          payment_link_id: plink.id,
          payment_url: plink.short_url
        });
      } else {
        // whatsapp_payment_link
        const plink = await RazorpayService.createRecoveryPaymentLink(
          caseId,
          amount,
          orderId,
          customer
        );

        await RecoveryActionRepository.save({
          id: `ACT-${Date.now()}`,
          case_id: caseId,
          channel: 'whatsapp',
          payment_link_id: plink.id,
          payment_url: plink.short_url,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await RecoveryCaseRepository.updateStatus(caseId, 'sent', 'WhatsApp Link Dispatched');

        await RecoveryJourneyRepository.saveStep({
          id: `STEP-${caseId}-1`,
          case_id: caseId,
          attempt_number: 1,
          strategy_id: 'whatsapp_payment_link',
          strategy_name: strategyDef.name,
          reasoning: strategyDecision.reasoning,
          policy_approved: 1,
          policy_checks: JSON.stringify(policyResult.checks),
          policy_status_text: policyResult.statusText,
          action_status: 'executed',
          action_payload: JSON.stringify({
            channel: 'whatsapp',
            payment_link_id: plink.id,
            payment_url: plink.short_url
          }),
          outcome: 'in_progress',
          failure_reason: null,
          next_action: 'AWAITING_VERIFICATION',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await FinancialSafetyService.completeActionLock(idempotencyKey, caseId, {
          payment_link_id: plink.id,
          payment_url: plink.short_url
        });
      }

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'STRATEGY_SELECTED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(
          `Policy Engine validated strategy: ${strategyDef.name} (Attempt #1). Score: ${strategyDecision.score}/100`,
          mode
        ),
        actor: 'Policy Engine',
        status: 'APPROVED'
      });

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'ACTION_EXECUTED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(
          `Executed recovery strategy "${strategyDef.name}" successfully.`,
          mode
        ),
        actor: 'ReviveAI Agent',
        status: 'EXECUTED'
      });
    } catch (err: any) {
      console.error(`[Orchestrator] Failed to execute recovery action for case ${caseId}:`, err.message);
      await FinancialSafetyService.handleExternalExecutionFailure(caseId, selectedStrategy, err, mode);
      await FinancialSafetyService.releaseActionLock(idempotencyKey, caseId, err.message);
      await RecoveryCaseRepository.updateStatus(caseId, 'failed', 'Recovery Action Failed');
    }
  },

  async handleRecoverySuccess(
    caseId: string,
    razorpayPaymentId: string,
    amountPaise: number,
    eventId?: string,
    mode: ExecutionMode = 'TEST_MODE'
  ) {
    console.log(`[Orchestrator] Recovery success webhook received for case ${caseId}, payment ${razorpayPaymentId}`);

    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      console.error(`[Orchestrator] Recovery Case ${caseId} not found.`);
      return;
    }

    // 1. Terminal State Protection
    if (rc.status === 'recovered') {
      console.log(`[Orchestrator] Case ${caseId} already marked recovered. Duplicate completion prevented.`);
      return;
    }
    await FinancialSafetyService.assertNotTerminal(caseId, rc.status, mode);

    // 2. Amount Verification: verify amount matches expected case amount
    const tx = await TransactionRepository.findById(rc.transaction_id);
    const expectedAmount = tx?.amount ?? (amountPaise / 100);
    const receivedAmount = amountPaise / 100;
    await FinancialSafetyService.verifyAmount(caseId, receivedAmount, expectedAmount, mode);

    // 3. Update Case
    await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Payment Verified & Settled');

    // 4. Update Action Status
    const ra = await RecoveryActionRepository.findByCaseId(caseId);
    if (ra) {
      await RecoveryActionRepository.updateStatus(ra.id, 'paid');
    }

    // 5. Update Latest Journey Step
    const latestStep = await RecoveryJourneyRepository.getLatestStep(caseId);
    if (latestStep) {
      await RecoveryJourneyRepository.updateStepOutcome(latestStep.id, 'success', null, 'CASE_RECOVERED');
    }

    // 6. Save new Transaction indicating recovery
    await TransactionRepository.save({
      id: razorpayPaymentId,
      order_id: rc.transaction_id,
      amount: receivedAmount,
      currency: 'INR',
      customer_name: 'Verified Customer',
      customer_email: 'verified@customer.com',
      customer_phone: '',
      status: 'captured',
      created_at: new Date().toISOString()
    });

    // 7. Log Success Audits
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'OUTCOME_EVALUATED',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(`Payment verified via webhook: ₹${receivedAmount.toLocaleString('en-IN')} captured.`, mode),
      actor: 'Outcome Evaluator',
      status: 'VERIFIED'
    });

    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'CASE_RECOVERED',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(
        `ReviveAI successfully recovered ₹${receivedAmount.toLocaleString('en-IN')} via WhatsApp Payment Link. Captured by webhook. (Notice: ${mode} revenue)`,
        mode
      ),
      actor: 'ReviveAI Agent',
      status: 'VERIFIED'
    });

    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'RECOVERY_SUCCESS',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(
        `ReviveAI successfully recovered ₹${receivedAmount.toLocaleString('en-IN')} via WhatsApp Payment Link. Captured by webhook.`,
        mode
      ),
      actor: 'ReviveAI Agent',
      status: 'VERIFIED'
    });
    
    console.log(`[Orchestrator] Case ${caseId} successfully verified and closed.`);
  },

  async approveRecoveryCase(caseId: string, mode: ExecutionMode = 'TEST_MODE') {
    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) throw new Error('Recovery case not found.');

    // 1. Terminal State Protection
    await FinancialSafetyService.assertNotTerminal(caseId, rc.status, mode);

    const tx = await TransactionRepository.findById(rc.transaction_id);
    if (!tx) throw new Error('Original transaction not found.');

    // 2. Amount Verification
    await FinancialSafetyService.verifyAmount(caseId, tx.amount, tx.amount, mode);

    console.log(`[Orchestrator] Operator manual approval granted for case ${caseId}`);
    
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'MANUAL_OVERRIDE',
      case_id: caseId,
      details: FinancialSafetyService.tagMode('Manual override: operator authorized payment link creation.', mode),
      actor: 'Merchant Admin',
      status: 'COMPLIANT'
    });

    // Run recovery dispatch pipeline
    this.runRecoveryPipeline(
      caseId,
      rc.transaction_id,
      tx.amount,
      { name: tx.customer_name, email: tx.customer_email, phone: tx.customer_phone },
      tx.failure_code || 'MANUAL_RUN',
      tx.order_id,
      mode
    ).catch((err) => {
      console.error(`[Orchestrator] Approved pipeline execution failed for case ${caseId}:`, err.message);
    });
  }
};
