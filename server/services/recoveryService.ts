import { TransactionRepository } from '../repositories/transactionRepository';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { AiDiagnosisRepository } from '../repositories/aiDiagnosisRepository';
import { PolicyDecisionRepository } from '../repositories/policyDecisionRepository';
import { RecoveryActionRepository } from '../repositories/recoveryActionRepository';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { diagnosePaymentFailureWithGemini } from './geminiService';
import { evaluateDeterministicSafetyRules } from './policyEngine';
import { RazorpayService } from './razorpayService';

export const RecoveryService = {
  async handlePaymentFailure(
    paymentId: string,
    orderId: string,
    amount: number,
    customer: { name: string; email: string; phone: string },
    failureCode: string,
    failureReason: string
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
      details: `Failed transaction of ₹${amount.toLocaleString('en-IN')} ingested via Razorpay webhook. Code: ${failureCode}`,
      actor: 'Policy Engine',
      status: 'COMPLIANT'
    });

    // 4. Trigger Async Pipeline (AI Diagnosis -> Safety Check -> Execution)
    // Run asynchronously to return response to webhook immediately
    this.runRecoveryPipeline(caseId, paymentId, amount, customer, failureCode, orderId).catch((err) => {
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
    orderId: string
  ) {
    console.log(`[Orchestrator] Starting diagnosis & rule check for case ${caseId}`);
    
    // Stage 1: AI Diagnosis
    await RecoveryCaseRepository.updateStatus(caseId, 'diagnosing', 'Gemini AI Diagnosis');
    
    const diagnosis = await diagnosePaymentFailureWithGemini(
      amount,
      failureCode,
      'UPI', // Default to UPI for simulated triggers
      0, // Assume 0 previous retries in clean demo run
      customer.name
    );

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
      details: `Gemini completed root cause analysis: ${diagnosis.rootCause} (Confidence: ${Math.round(diagnosis.confidence * 100)}%)`,
      actor: 'ReviveAI Agent',
      status: 'COMPLIANT'
    });

    // Stage 2: Policy Safety Check
    await RecoveryCaseRepository.updateStatus(caseId, 'safety_checking', 'Safety Sentinel Policy Check');
    
    // Enforce duplicate protection checks
    const activeCases = await RecoveryCaseRepository.findAll();
    const isDuplicateActive = activeCases.some(
      (c) => c.transaction_id === paymentId && c.id !== caseId && ['sent', 'authorized', 'new'].includes(c.status)
    );

    const policyResult = evaluateDeterministicSafetyRules(
      amount,
      0, // retryCount
      diagnosis,
      isDuplicateActive
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
        details: `Recovery halted. Reason: policy check failed: ${policyResult.statusText}`,
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
        details: `Held for merchant operator approval — ${policyResult.statusText}`,
        actor: 'Policy Engine',
        status: 'COMPLIANT'
      });
      return;
    }

    // Stage 3: Authorized & Execution (Create Payment Link)
    await RecoveryCaseRepository.updateStatus(caseId, 'authorized', 'Creating Razorpay Payment Link');
    
    try {
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

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'RECOVERY_SENT',
        case_id: caseId,
        details: `Recovery Payment Link generated (${plink.id}) and simulated dispatch to customer WhatsApp successfully completed.`,
        actor: 'ReviveAI Agent',
        status: 'EXECUTED'
      });

    } catch (err: any) {
      console.error(`[Orchestrator] Failed to execute recovery action for case ${caseId}:`, err.message);
      await RecoveryCaseRepository.updateStatus(caseId, 'failed', 'Recovery Action Failed');
    }
  },

  async handleRecoverySuccess(caseId: string, razorpayPaymentId: string, amount: number) {
    console.log(`[Orchestrator] Recovery success webhook received for case ${caseId}, payment ${razorpayPaymentId}`);

    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      console.error(`[Orchestrator] Recovery Case ${caseId} not found.`);
      return;
    }

    // 1. Update Case
    await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Payment Verified & Settled');

    // 2. Update Action Status
    const ra = await RecoveryActionRepository.findByCaseId(caseId);
    if (ra) {
      await RecoveryActionRepository.updateStatus(ra.id, 'paid');
    }

    // 3. Save new Transaction indicating recovery
    await TransactionRepository.save({
      id: razorpayPaymentId,
      order_id: rc.transaction_id, // Link to original failed transaction payment ID or order ID
      amount: amount / 100, // convert from paise
      currency: 'INR',
      customer_name: 'Verified Customer',
      customer_email: 'verified@customer.com',
      customer_phone: '',
      status: 'captured',
      created_at: new Date().toISOString()
    });

    // 4. Log Success Audit
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'RECOVERY_SUCCESS',
      case_id: caseId,
      details: `ReviveAI successfully recovered ₹${(amount / 100).toLocaleString('en-IN')} via WhatsApp Payment Link. Captured by webhook.`,
      actor: 'ReviveAI Agent',
      status: 'VERIFIED'
    });
    
    console.log(`[Orchestrator] Case ${caseId} successfully verified and closed.`);
  },

  async approveRecoveryCase(caseId: string) {
    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) throw new Error('Recovery case not found.');

    const tx = await TransactionRepository.findById(rc.transaction_id);
    if (!tx) throw new Error('Original transaction not found.');

    console.log(`[Orchestrator] Operator manual approval granted for case ${caseId}`);
    
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'MANUAL_OVERRIDE',
      case_id: caseId,
      details: 'Manual override: operator authorized payment link creation.',
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
      tx.order_id
    ).catch((err) => {
      console.error(`[Orchestrator] Approved pipeline execution failed for case ${caseId}:`, err.message);
    });
  }
};
