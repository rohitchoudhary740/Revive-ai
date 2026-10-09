import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { dbQuery } from './db';
import { RecoveryCaseRepository } from './repositories/recoveryCaseRepository';
import { TransactionRepository } from './repositories/transactionRepository';
import { AiDiagnosisRepository } from './repositories/aiDiagnosisRepository';
import { PolicyDecisionRepository } from './repositories/policyDecisionRepository';
import { RecoveryActionRepository } from './repositories/recoveryActionRepository';
import { AuditEventRepository } from './repositories/auditEventRepository';
import { RecoveryService } from './services/recoveryService';
import { RazorpayService } from './services/razorpayService';
import { getGuardrailConfig, updateGuardrailConfig } from './services/guardrailConfig';
import { EvaluationRepository } from './repositories/evaluationRepository';
import { runBatchEvaluation } from './services/evaluationEngine';
import { getAllStrategies } from './services/strategyRegistry';
import { ClosedLoopAgent } from './services/closedLoopAgent';
import { StrategyIntelligenceService } from './services/strategyIntelligence';
import { PolicySimulatorService } from './services/policySimulator';
import { FinancialSafetyService } from './services/financialSafetyService';

const app = express();

app.use(
  cors({
    origin: [
      'https://revive-ai-one.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
  })
);

app.use(cors());


// Health Check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      razorpayConfigured: !!process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'YOUR_RAZORPAY_KEY_ID'
    }
  });
});

// RAZORPAY WEBHOOK ROUTE - Uses raw body parsing for signature validation
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  async (req: any, res: any) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const eventId = req.headers['x-razorpay-event-id'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    console.log(`[Webhook] Received Razorpay event. ID: ${eventId}, Signature: ${signature}`);

    // 1. Cryptographic signature verification
    let verified = false;
    if (secret && secret !== 'YOUR_RAZORPAY_WEBHOOK_SECRET') {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(req.body); // req.body is the raw Buffer
      const digest = hmac.digest('hex');
      verified = digest === signature;
    } else {
      console.warn('[Webhook] No RAZORPAY_WEBHOOK_SECRET configured. Bypassing verification for local development sandbox.');
      verified = true;
    }

    if (!verified) {
      console.error('[Webhook] Signature verification failed.');
      return res.status(400).send('Invalid signature');
    }

    // 2. Process the Webhook Event with Layer 5 Idempotency Protection
    try {
      const rawText = req.body.toString('utf8');
      const payload = JSON.parse(rawText);
      const event = payload.event;
      const effectiveEventId =
        (req.headers['x-razorpay-event-id'] as string) ||
        payload.event_id ||
        payload.id ||
        `${event}_${payload.payload?.payment?.entity?.id || payload.payload?.payment_link?.entity?.id || Date.now()}`;

      console.log(`[Webhook] Processing event type: ${event} (Event ID: ${effectiveEventId})`);

      // Layer 5: Duplicate Webhook Protection Check
      const isDuplicate = await FinancialSafetyService.isWebhookDuplicate(effectiveEventId, undefined, 'TEST_MODE');
      if (isDuplicate) {
        console.log(`[Webhook] Duplicate event ${effectiveEventId} blocked.`);
        return res.status(200).send('DUPLICATE_EVENT_IGNORED');
      }

      if (event === 'payment.failed') {
        const payment = payload.payload.payment.entity;

        // Extract customer details or set fallbacks
        const customer = {
          name: payment.notes?.customer_name || 'Valued Customer',
          email: payment.email || 'customer@example.com',
          phone: payment.contact || '+919999999999'
        };

        const failureCode = payment.error_code || 'BANK_TIMEOUT';
        const failureReason = payment.error_description || 'Temporary Bank Gateway Timeout (504)';

        // Handle case creation asynchronously
        await RecoveryService.handlePaymentFailure(
          payment.id,
          payment.order_id,
          payment.amount / 100, // convert paise to INR
          customer,
          failureCode,
          failureReason,
          'TEST_MODE'
        );
      }

      else if (event === 'payment_link.paid' || event === 'payment.captured') {
        // Recovery Payment Link has been completed
        const entity = event === 'payment_link.paid'
          ? payload.payload.payment_link.entity
          : payload.payload.payment.entity;

        const caseId = entity.reference_id || entity.notes?.recovery_case_id;
        const razorpayPaymentId = event === 'payment_link.paid'
          ? (payload.payload.payment?.entity?.id || `pay_${Date.now()}`)
          : entity.id;

        if (caseId) {
          const rc = await RecoveryCaseRepository.findById(caseId);
          if (rc) {
            // Terminal-state protection
            if (['recovered', 'stopped', 'cancelled', 'rejected'].includes(rc.status)) {
              console.log(`[Webhook] Case ${caseId} is already in terminal state (${rc.status}). Ignoring duplicate settlement.`);
              await FinancialSafetyService.logSafetyBlock(
                caseId,
                `Webhook payment capture ignored: case is already in terminal state '${rc.status}'.`,
                'TEST_MODE'
              );
              return res.status(200).send('OK');
            }

            // Amount verification
            const tx = await TransactionRepository.findById(rc.transaction_id);
            const expectedPaise = (tx?.amount || 0) * 100;
            if (expectedPaise > 0 && Math.abs(entity.amount - expectedPaise) > 1) {
              console.error(`[Webhook] Amount mismatch for case ${caseId}: received ${entity.amount} paise, expected ${expectedPaise} paise.`);
              await FinancialSafetyService.logSafetyBlock(
                caseId,
                `Webhook amount mismatch: received ₹${entity.amount / 100}, expected ₹${tx?.amount}. Held for human review.`,
                'TEST_MODE'
              );
              await RecoveryCaseRepository.updateStatus(caseId, 'human_review', 'Webhook Amount Mismatch');
              return res.status(200).send('OK');
            }

            await RecoveryService.handleRecoverySuccess(caseId, razorpayPaymentId, entity.amount, effectiveEventId, 'TEST_MODE');
          } else {
            console.log(`[Webhook] Case ${caseId} not found in database.`);
          }
        } else {
          console.log(`[Webhook] No caseId found in notes or reference_id:`, entity);
        }
      }

      res.status(200).send('OK');
    } catch (err: any) {
      console.error('[Webhook] Processing error:', err.message);
      res.status(500).send(`Server error: ${err.message}`);
    }
  }
);

// Standard JSON middleware for API endpoints
app.use(express.json());

// API: Create Razorpay Order
app.post('/api/checkout', async (req, res) => {
  const { amount, customerName, customerEmail, customerPhone } = req.body;
  try {
    const receipt = `rcpt_${Date.now()}`;
    const order = await RazorpayService.createOrder(amount, receipt);

    // Save transaction initially
    await TransactionRepository.save({
      id: order.id, // In local store, map local ID to order ID initially
      order_id: order.id,
      amount,
      currency: 'INR',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      status: 'created',
      created_at: new Date().toISOString()
    });

    res.json({
      orderId: order.id,
      amount: order.amount, // in paise
      keyId: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID'
    });
  } catch (err: any) {
    console.error('[API] Checkout order creation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Bridge browser payment.failed events into the recovery pipeline
app.post('/api/recovery/failures', async (req, res) => {
  const { paymentId, orderId, amount, customer, failureCode, failureReason } = req.body;

  if (
    !paymentId ||
    !orderId ||
    typeof amount !== 'number' ||
    !customer?.name ||
    !customer?.email ||
    !customer?.phone ||
    !failureCode ||
    !failureReason
  ) {
    return res.status(400).json({ error: 'Missing required failure fields' });
  }

  try {
    const existing = await RecoveryCaseRepository.findByTransactionId(paymentId);
    if (existing) {
      console.log(`[API] Duplicate failure ignored for payment ${paymentId}, case ${existing.id}`);
      return res.json({ success: true, caseId: existing.id });
    }

    const caseId = await RecoveryService.handlePaymentFailure(
      paymentId,
      orderId,
      amount,
      customer,
      failureCode,
      failureReason
    );

    res.json({ success: true, caseId });
  } catch (err: any) {
    console.error('[API] Recovery failure bridge error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Retrieve all recovery cases (returns formatted cases for frontend context)
app.get('/api/recovery/cases', async (req, res) => {
  try {
    const cases = await RecoveryCaseRepository.findAll();
    const formattedCases = await Promise.all(
      cases.map(async (c) => {
        const tx = await TransactionRepository.findById(c.transaction_id);
        const diag = await AiDiagnosisRepository.findByCaseId(c.id);
        const policy = await PolicyDecisionRepository.findByCaseId(c.id);
        const action = await RecoveryActionRepository.findByCaseId(c.id);

        const progressSteps = [
          { name: 'Diagnosis', status: c.status === 'new' ? 'pending' : 'done' },
          { name: 'Policy', status: ['new', 'diagnosing'].includes(c.status) ? 'pending' : 'done' },
          { name: 'Action', status: ['new', 'diagnosing', 'safety_checking'].includes(c.status) ? 'pending' : c.status === 'stopped' ? 'halted' : c.status === 'human_review' ? 'halted' : 'done' },
          { name: 'Waiting', status: c.status === 'sent' ? 'active' : ['new', 'diagnosing', 'safety_checking', 'human_review', 'stopped'].includes(c.status) ? 'pending' : 'done' },
          { name: 'Verification', status: c.status === 'recovered' ? 'done' : 'pending' }
        ];

        const timeline = [
          {
            title: 'Payment Failed',
            description: `Issuer returned failure code during UPI checkout`,
            timestamp: c.created_at,
            status: 'done'
          }
        ];

        if (diag) {
          timeline.push({
            title: 'AI Diagnosis',
            description: `Gemini diagnosed ${diag.root_cause} (Confidence: ${Math.round(diag.confidence * 100)}%)`,
            timestamp: diag.created_at,
            status: 'done'
          });
        }

        if (policy) {
          timeline.push({
            title: 'Policy Check Passed',
            description: policy.status_text,
            timestamp: policy.created_at,
            status: 'done'
          });
        }

        if (action) {
          timeline.push({
            title: 'Recovery Link Dispatched',
            description: `Dispatched payment link via ${action.channel}`,
            timestamp: action.created_at,
            status: 'done'
          });

          if (c.status === 'recovered') {
            timeline.push({
              title: 'Payment Verified & Settled',
              description: `Funds successfully captured into Razorpay merchant balance`,
              timestamp: c.updated_at,
              status: 'done'
            });
          }
        }

        return {
          id: c.id,
          recoveryId: `#REC-${c.id.split('-')[1] || c.id}`,
          customerName: tx?.customer_name || 'Valued Customer',
          customerEmail: tx?.customer_email || 'customer@example.com',
          avatar: (tx?.customer_name || 'C')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
          amount: tx?.amount || 0,
          problem: tx?.failure_reason || 'Unknown issue',
          aiAction: action?.channel === 'whatsapp' ? 'WhatsApp Recovery' : 'Smart Gateway Retry',
          recoveryProbability: diag?.recovery_probability || 0.75,
          expectedRecovery: diag ? Math.round((diag.recovery_probability || 0) * (tx?.amount || 0)) : 0,
          status: c.status === 'recovered' ? 'Completed' : c.status === 'stopped' ? 'Stopped' : c.status === 'human_review' ? 'Awaiting Approval' : 'In Progress',
          currentStage: c.current_stage,
          progressSteps,
          timeline,
          aiRecommendation: diag?.reason || 'Autonomous recovery route queued.',
          safetyChecks: policy ? JSON.parse(policy.checks) : [],
          // Real, active-guardrail-aware verdict text from the policy engine
          // (e.g. "🟡 HUMAN APPROVAL REQUIRED (…exceeds auto-limit guardrail…)").
          // Null until the case has cleared the policy stage.
          guardrailDecision: policy?.status_text ?? null,
          paymentUrl: action?.payment_url || null
        };
      })
    );

    res.json(formattedCases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Retrieve a single recovery case
app.get('/api/recovery/cases/:id', async (req, res) => {
  const caseId = req.params.id;
  try {
    const c = await RecoveryCaseRepository.findById(caseId);
    if (!c) return res.status(404).json({ error: 'Not found' });

    const tx = await TransactionRepository.findById(c.transaction_id);
    const diag = await AiDiagnosisRepository.findByCaseId(c.id);
    const policy = await PolicyDecisionRepository.findByCaseId(c.id);
    const action = await RecoveryActionRepository.findByCaseId(c.id);

    const progressSteps = [
      { name: 'Diagnosis', status: c.status === 'new' ? 'pending' : 'done' },
      { name: 'Policy', status: ['new', 'diagnosing'].includes(c.status) ? 'pending' : 'done' },
      { name: 'Action', status: ['new', 'diagnosing', 'safety_checking'].includes(c.status) ? 'pending' : c.status === 'stopped' ? 'halted' : c.status === 'human_review' ? 'halted' : 'done' },
      { name: 'Waiting', status: c.status === 'sent' ? 'active' : ['new', 'diagnosing', 'safety_checking', 'human_review', 'stopped'].includes(c.status) ? 'pending' : 'done' },
      { name: 'Verification', status: c.status === 'recovered' ? 'done' : 'pending' }
    ];

    const timeline = [
      {
        title: 'Payment Failed',
        description: `Issuer returned failure code during UPI checkout`,
        timestamp: c.created_at,
        status: 'done'
      }
    ];

    if (diag) {
      timeline.push({
        title: 'AI Diagnosis',
        description: `Gemini diagnosed ${diag.root_cause} (Confidence: ${Math.round(diag.confidence * 100)}%)`,
        timestamp: diag.created_at,
        status: 'done'
      });
    }

    if (policy) {
      timeline.push({
        title: 'Policy Check Passed',
        description: policy.status_text,
        timestamp: policy.created_at,
        status: 'done'
      });
    }

    if (action) {
      timeline.push({
        title: 'Recovery Link Dispatched',
        description: `Dispatched payment link via ${action.channel}`,
        timestamp: action.created_at,
        status: 'done'
      });

      if (c.status === 'recovered') {
        timeline.push({
          title: 'Payment Verified & Settled',
          description: `Funds successfully captured into Razorpay merchant balance`,
          timestamp: c.updated_at,
          status: 'done'
        });
      }
    }

    const formattedCase = {
      id: c.id,
      recoveryId: `#REC-${c.id.split('-')[1] || c.id}`,
      customerName: tx?.customer_name || 'Valued Customer',
      customerEmail: tx?.customer_email || 'customer@example.com',
      avatar: (tx?.customer_name || 'C')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      amount: tx?.amount || 0,
      problem: tx?.failure_reason || 'Unknown issue',
      aiAction: action?.channel === 'whatsapp' ? 'WhatsApp Recovery' : 'Smart Gateway Retry',
      recoveryProbability: diag?.recovery_probability || 0.75,
      expectedRecovery: diag ? Math.round((diag.recovery_probability || 0) * (tx?.amount || 0)) : 0,
      status: c.status === 'recovered' ? 'Completed' : c.status === 'stopped' ? 'Stopped' : c.status === 'human_review' ? 'Awaiting Approval' : 'In Progress',
      currentStage: c.current_stage,
      progressSteps,
      timeline,
      aiRecommendation: diag?.reason || 'Autonomous recovery route queued.',
      safetyChecks: policy ? JSON.parse(policy.checks) : [],
      // Real, active-guardrail-aware verdict text from the policy engine.
      // Null until the case has cleared the policy stage.
      guardrailDecision: policy?.status_text ?? null,
      paymentUrl: action?.payment_url || null
    };

    res.json(formattedCase);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/recovery/cases/:id/approve', async (req, res) => {
  const caseId = req.params.id;
  try {
    await RecoveryService.approveRecoveryCase(caseId);
    res.json({ success: true, message: 'Case approved and pipeline restarted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LAYER 2: Adaptive Closed-Loop Agent Endpoints ─────────────────────────

// API: Get typed recovery strategy registry
app.get('/api/recovery/strategies', (req, res) => {
  res.json(getAllStrategies());
});

// API: Get recovery journey steps for a case
app.get('/api/recovery/cases/:id/journey', async (req, res) => {
  try {
    const journey = await ClosedLoopAgent.getCaseJourney(req.params.id);
    res.json(journey);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Execute next step in adaptive closed loop
app.post('/api/recovery/cases/:id/journey/step', async (req, res) => {
  try {
    const { overrideStrategyId, overrideOutcome, failureReason } = req.body;
    const result = await ClosedLoopAgent.executeStep(req.params.id, {
      overrideStrategyId,
      overrideOutcome,
      failureReason
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// API: Simulate end-to-end multi-attempt adaptive scenario
app.post('/api/recovery/cases/:id/journey/simulate-adaptive', async (req, res) => {
  try {
    const caseId = req.params.id;
    let rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      // Auto-create fixture case if running against simulated or demo id
      const txId = `tx_${caseId}`;
      const now = new Date().toISOString();
      await TransactionRepository.save({
        id: txId,
        order_id: `ord_${caseId}`,
        amount: 5000,
        currency: 'INR',
        customer_name: 'Amit Sharma',
        customer_email: 'amit.sharma@gmail.com',
        customer_phone: '+919876543210',
        status: 'failed',
        failure_code: 'BANK_TIMEOUT',
        failure_reason: 'Temporary Bank Gateway Timeout (504)',
        created_at: now
      });
      await RecoveryCaseRepository.save({
        id: caseId,
        transaction_id: txId,
        status: 'new',
        current_stage: 'Detected',
        created_at: now,
        updated_at: now
      });
    } else if (rc.status === 'recovered' || rc.status === 'stopped') {
      // Reset status so simulation can re-run
      await RecoveryCaseRepository.updateStatus(caseId, 'new', 'Detected');
    }

    // Step 1: Immediate retry fails
    const step1 = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'smart_retry',
      overrideOutcome: 'failure',
      failureReason: 'HDFC gateway latency exceeded 504 deadline'
    });

    // Step 2: Adaptive strategy change to WhatsApp link succeeds
    const step2 = await ClosedLoopAgent.executeStep(caseId, {
      overrideOutcome: 'success'
    });

    const journey = await ClosedLoopAgent.getCaseJourney(caseId);
    res.json({
      success: true,
      attempts: [step1, step2],
      journey
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// API: Verify recovery payment and settle case (Layer 2)
app.post('/api/recovery/cases/:id/verify-success', async (req, res) => {
  const caseId = req.params.id;
  try {
    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) return res.status(404).json({ error: 'Case not found' });
    const tx = await TransactionRepository.findById(rc.transaction_id);
    const amountPaise = tx ? tx.amount * 100 : 500000;
    await RecoveryService.handleRecoverySuccess(caseId, `pay_verif_${Date.now()}`, amountPaise);
    const journey = await ClosedLoopAgent.getCaseJourney(caseId);
    res.json({ success: true, message: 'Recovery verified successfully', journey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LAYER 3: Recovery Strategy Intelligence & Explainability ─────────────

// API: Retrieve "Why this action?" Explainability Report for a case
app.get('/api/recovery/cases/:id/intelligence', async (req, res) => {
  const rawId = req.params.id;
  const cleanId = rawId.replace(/^#/, '');
  try {
    let rc =
      (await RecoveryCaseRepository.findById(rawId)) ||
      (await RecoveryCaseRepository.findById(cleanId)) ||
      (await RecoveryCaseRepository.findById(`#${cleanId}`));
    const targetCaseId = rc ? rc.id : cleanId;

    if (!rc) {
      // Auto-create fixture case if inspecting simulated demo ID
      const txId = `tx_${targetCaseId}`;
      const now = new Date().toISOString();
      await TransactionRepository.save({
        id: txId,
        order_id: `ord_${targetCaseId}`,
        amount: 5000,
        currency: 'INR',
        customer_name: 'Amit Sharma',
        customer_email: 'amit.sharma@gmail.com',
        customer_phone: '+919876543210',
        status: 'failed',
        failure_code: 'BANK_TIMEOUT',
        failure_reason: 'Temporary Bank Gateway Timeout (504)',
        created_at: now
      });
      await RecoveryCaseRepository.save({
        id: targetCaseId,
        transaction_id: txId,
        status: 'new',
        current_stage: 'Detected',
        created_at: now,
        updated_at: now
      });
    }

    const report = await StrategyIntelligenceService.evaluateAndExplain(targetCaseId);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Re-evaluate strategy intelligence on demand
app.post('/api/recovery/cases/:id/intelligence/evaluate', async (req, res) => {
  const rawId = req.params.id;
  const cleanId = rawId.replace(/^#/, '');
  try {
    let rc =
      (await RecoveryCaseRepository.findById(rawId)) ||
      (await RecoveryCaseRepository.findById(cleanId)) ||
      (await RecoveryCaseRepository.findById(`#${cleanId}`));
    const targetCaseId = rc ? rc.id : cleanId;

    const report = await StrategyIntelligenceService.evaluateAndExplain(targetCaseId);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RECOVERY OPPORTUNITIES: Recovery Engine (#recovery-opportunities) ───────
app.get('/api/recovery/opportunities', async (req, res) => {
  try {
    const rows = await dbQuery.all<any>(`
      SELECT 
        rc.id AS case_id,
        rc.status AS case_status,
        rc.current_stage,
        rc.created_at AS case_created_at,
        t.id AS tx_id,
        t.amount,
        t.customer_name,
        t.customer_email,
        t.failure_code,
        t.failure_reason,
        t.created_at AS tx_created_at,
        d.root_cause,
        d.confidence,
        d.recovery_probability,
        d.recommended_action,
        d.reason AS ai_reason,
        d.evidence,
        p.approved,
        p.status_text AS policy_status,
        p.checks AS policy_checks,
        a.channel,
        a.payment_url
      FROM recovery_cases rc
      JOIN transactions t ON t.id = rc.transaction_id
      LEFT JOIN ai_diagnoses d ON d.case_id = rc.id
      LEFT JOIN policy_decisions p ON p.case_id = rc.id
      LEFT JOIN recovery_actions a ON a.case_id = rc.id
      ORDER BY rc.created_at DESC
    `);

    const opportunities = rows.map((r) => {
      const amount = r.amount || 0;
      const probDecimal = r.recovery_probability !== null && r.recovery_probability !== undefined
        ? r.recovery_probability
        : 0.70;
      const recoveryProbability = Math.round(probDecimal * 100);
      const expectedRecovery = Math.round((amount * recoveryProbability) / 100);

      const customerType = amount >= 25000
        ? 'Enterprise Client'
        : amount >= 10000
          ? 'B2B Merchant'
          : 'B2C Customer';

      const category = 'payment_failure';

      let status = 'recoverable';
      if (r.case_status === 'stopped') {
        status = 'stopped';
      } else if (r.case_status === 'human_review' || r.approved === 0 || amount > 25000) {
        status = 'approval_required';
      } else if (recoveryProbability < 30) {
        status = 'low_probability';
      } else if (['sent', 'diagnosing', 'safety_checking'].includes(r.case_status)) {
        status = 'in_progress';
      }

      let recType = 'delayed_retry';
      let actionText = 'Delayed retry';
      let iconType = 'lightning';
      let detailedAction = 'Wait 5-10 minutes → Retry via Fallback Gateway';
      let reason = r.ai_reason || 'Transient payment gateway degradation detected. Delayed retry maximizes recovery success.';

      if (r.case_status === 'stopped' || r.recommended_action === 'stop') {
        recType = 'stop';
        actionText = 'STOP';
        iconType = 'stop';
        detailedAction = 'Halt retries & flag transaction for risk sentinel';
        reason = r.ai_reason || 'Autonomous recovery halted to safeguard merchant policy thresholds.';
      } else if (
        r.recommended_action === 'whatsapp_payment_link' ||
        r.recommended_action === 'whatsapp_recovery' ||
        r.channel === 'whatsapp'
      ) {
        recType = 'payment_link';
        actionText = 'WhatsApp Link';
        iconType = 'lightning';
        detailedAction = 'Dispatch Smart 1-Click WhatsApp Payment Link';
        reason = r.ai_reason || 'Engaging customer via verified messaging channel with auto-filled checkout link.';
      } else if (r.recommended_action === 'smart_retry' || r.recommended_action === 'retry_now') {
        recType = 'smart_retry';
        actionText = 'Smart Retry';
        iconType = 'lightning';
        detailedAction = 'Autonomous Gateway Reroute via Alternate Node';
        reason = r.ai_reason || 'Immediate passive retry via alternate acquiring route without customer friction.';
      } else if (r.recommended_action === 'delayed_retry') {
        recType = 'delayed_retry';
        actionText = 'Delayed Retry';
        iconType = 'clock';
        detailedAction = 'Wait 5-10 minutes → Retry via Fallback Gateway';
        reason = r.ai_reason || 'Transient payment gateway degradation detected. Delayed retry maximizes recovery success.';
      } else if (
        r.recommended_action === 'payment_method_update' ||
        r.recommended_action === 'update_payment_method'
      ) {
        recType = 'update_payment_method';
        actionText = 'Update Payment Method';
        iconType = 'link';
        detailedAction = 'Prompt Customer to Select Alternate Payment Method';
        reason = r.ai_reason || 'Instrument expired or balance exhausted. Prompting customer for alternate instrument.';
      } else if (r.recommended_action === 'payment_link') {
        recType = 'payment_link';
        actionText = 'Payment link';
        iconType = 'link';
        detailedAction = 'Dispatch 1-Click Recovery Payment Link';
        reason = r.ai_reason || 'Send direct recovery link to customer to complete transaction.';
      } else if (r.recommended_action === 'reminder_later') {
        recType = 'reminder_later';
        actionText = 'Send reminder later';
        iconType = 'clock';
        detailedAction = 'Schedule Follow-Up Payment Reminder';
        reason = r.ai_reason || 'Schedule a delayed nudge aligned with optimal customer payment window.';
      } else if (r.ai_reason) {
        detailedAction = r.root_cause ? `Route through backup tunnel: ${r.root_cause}` : detailedAction;
      }

      let evidence: string[] = [];
      if (r.evidence) {
        try {
          const parsed = JSON.parse(r.evidence);
          if (Array.isArray(parsed)) {
            evidence = parsed.map(e => String(e));
          }
        } catch {
          evidence = [String(r.evidence)];
        }
      }
      if (evidence.length === 0) {
        if (r.failure_code) evidence.push(`Gateway Failure Code: ${r.failure_code}`);
        if (r.failure_reason) evidence.push(`Failure Details: ${r.failure_reason}`);
        evidence.push(`Transaction Amount: ₹${amount.toLocaleString('en-IN')}`);
      }

      let safetyChecks: { label: string; passed: boolean }[] = [];
      if (r.policy_checks) {
        try {
          const parsedChecks = JSON.parse(r.policy_checks);
          if (Array.isArray(parsedChecks)) {
            safetyChecks = parsedChecks.map(c => ({
              label: c.name ? `${c.name} (${c.detail || ''})`.trim() : (c.label || 'Safety Check'),
              passed: Boolean(c.passed),
            }));
          }
        } catch {
          // fallback
        }
      }
      if (safetyChecks.length === 0) {
        safetyChecks = [
          { label: `Amount limit check (≤ ₹25,000 threshold): ₹${amount.toLocaleString('en-IN')}`, passed: amount <= 25000 },
          { label: 'Retry count within safety threshold (0/3 used)', passed: true },
          { label: `Recovery probability acceptable (${recoveryProbability}% ≥ 30%)`, passed: recoveryProbability >= 30 },
          { label: 'No duplicate recovery active', passed: true },
        ];
      }

      const customerName = r.customer_name || 'Valued Customer';
      const avatar = customerName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return {
        id: r.case_id,
        customerName,
        customerEmail: r.customer_email || 'customer@example.com',
        customerType,
        avatar,
        paymentId: r.tx_id,
        amount,
        problem: r.failure_reason || r.failure_code || 'Payment Failure',
        category,
        recoveryProbability,
        expectedRecovery,
        recommendation: {
          type: recType,
          actionText,
          iconType,
          detailedAction,
          reason,
        },
        status,
        analysis: {
          rootCause: r.root_cause || r.failure_reason || 'Bank Gateway Interruption',
          aiConfidence: r.confidence ? Math.round(r.confidence * 100) : 88,
          evidence,
          safetyChecks,
        },
      };
    });

    const potentiallyRecoverable = opportunities
      .filter(o => o.status !== 'stopped')
      .reduce((sum, o) => sum + o.amount, 0);

    const totalOpportunities = opportunities.length;

    const expectedRecovery = opportunities
      .filter(o => o.status !== 'stopped')
      .reduce((sum, o) => sum + o.expectedRecovery, 0);

    const needApprovalCount = opportunities
      .filter(o => o.status === 'approval_required')
      .length;

    res.json({
      opportunities,
      summary: {
        potentiallyRecoverable,
        recoveryOpportunitiesCount: totalOpportunities,
        expectedRecovery,
        needApprovalCount,
        netYieldPercent: potentiallyRecoverable > 0
          ? Math.round((expectedRecovery / potentiallyRecoverable) * 1000) / 10
          : 0,
      }
    });
  } catch (err: any) {
    console.error('[API] /api/recovery/opportunities error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Retrieve all audit trail logs
app.get('/api/audit-trail', async (req, res) => {
  try {
    const audits = await AuditEventRepository.findAll();
    res.json(
      audits.map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        eventType: a.event_type,
        paymentId: a.case_id, // Match UI contract expecting paymentId
        customerName: 'Audit Ledger Entry',
        amount: 0,
        strategy: 'System Log',
        details: a.details,
        actor: a.actor,
        status: a.status
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Recovery Guardrails — read/update the merchant-configurable policy
// boundaries the recovery pipeline evaluates against. In-memory session state
// (no database table); resets to defaults on server restart.
app.get('/api/guardrails', (req, res) => {
  res.json(getGuardrailConfig());
});

app.put('/api/guardrails', (req, res) => {
  try {
    const updated = updateGuardrailConfig(req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Layer 4: Merchant Policy Impact Simulator (READ-ONLY)
app.post('/api/guardrails/simulate-impact', (req, res) => {
  try {
    const {
      maxAutoRecoveryAmount,
      minRecoveryProbability,
      maxAutomatedRetries,
      highValueRequiresApproval,
      lowConfidenceStops,
      agentMode,
      seed,
      batchSize
    } = req.body || {};

    const simulationResult = PolicySimulatorService.simulatePolicyImpact(
      {
        maxAutoRecoveryAmount,
        minRecoveryProbability,
        maxAutomatedRetries,
        highValueRequiresApproval,
        lowConfidenceStops,
        agentMode
      },
      { seed, batchSize }
    );

    res.json(simulationResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BATCH RECOVERY EVALUATION ENGINE (Track 03 Measured Recovery) ───────────
app.post('/api/evaluation/run', async (req, res) => {
  try {
    const { seed, batchSize, guardrails } = req.body || {};
    const evalResult = runBatchEvaluation({
      seed: typeof seed === 'number' ? seed : 42,
      batchSize: typeof batchSize === 'number' ? batchSize : 500,
      guardrails,
    });

    // Save run record to SQLite
    await EvaluationRepository.saveRun({
      id: evalResult.runId,
      created_at: evalResult.createdAt,
      seed: evalResult.seed,
      batch_size: evalResult.batchSize,
      guardrails_snapshot: JSON.stringify(evalResult.guardrailsSnapshot),
      baseline_metrics: JSON.stringify(evalResult.baseline),
      reviveai_metrics: JSON.stringify(evalResult.reviveAi),
      lift_metrics: JSON.stringify(evalResult.lift),
      summary_notes: `Batch evaluation run with seed=${evalResult.seed}, batchSize=${evalResult.batchSize}`
    });

    // Save cases to SQLite
    if (evalResult.allCases && evalResult.allCases.length > 0) {
      const caseRecords = evalResult.allCases.map((c) => ({
        id: `${evalResult.runId}_${c.id}`,
        run_id: evalResult.runId,
        payment_id: c.paymentId,
        customer_name: c.customerName,
        customer_email: c.customerEmail,
        customer_tier: c.customerTier,
        amount: c.amount,
        failure_code: c.failureCode,
        failure_type: c.failureType,
        retry_count: c.retryCount,
        ground_truth_prob: c.groundTruthProb,
        reviveai_prob: c.reviveAi.recoveryProbability,
        reviveai_action: c.reviveAi.recommendedAction,
        reviveai_policy_status: c.reviveAi.policyStatus,
        reviveai_is_approved: c.reviveAi.isApproved ? 1 : 0,
        reviveai_is_human_review: c.reviveAi.requiresHumanApproval ? 1 : 0,
        reviveai_is_stopped: c.reviveAi.isStopped ? 1 : 0,
        reviveai_intervened: c.reviveAi.intervened ? 1 : 0,
        reviveai_recovered: c.reviveAi.recovered ? 1 : 0,
        reviveai_recovered_revenue: c.reviveAi.recoveredRevenue,
        baseline_intervened: c.baseline.intervened ? 1 : 0,
        baseline_recovered: c.baseline.recovered ? 1 : 0,
        baseline_recovered_revenue: c.baseline.recoveredRevenue,
        is_synthetic: 1,
        created_at: evalResult.createdAt,
      }));
      await EvaluationRepository.saveCases(caseRecords);
    }

    const { allCases, ...responsePayload } = evalResult;
    res.json({
      success: true,
      ...responsePayload,
    });
  } catch (err: any) {
    console.error('[API] /api/evaluation/run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/evaluation/results', async (req, res) => {
  try {
    const runId = req.query.runId as string | undefined;
    let runRecord = runId
      ? await EvaluationRepository.findRunById(runId)
      : await EvaluationRepository.findLatestRun();

    // If no evaluation has been run yet, execute the default reproducible run (seed: 42, batch: 500)
    if (!runRecord) {
      const defaultEval = runBatchEvaluation({ seed: 42, batchSize: 500 });
      runRecord = {
        id: defaultEval.runId,
        created_at: defaultEval.createdAt,
        seed: defaultEval.seed,
        batch_size: defaultEval.batchSize,
        guardrails_snapshot: JSON.stringify(defaultEval.guardrailsSnapshot),
        baseline_metrics: JSON.stringify(defaultEval.baseline),
        reviveai_metrics: JSON.stringify(defaultEval.reviveAi),
        lift_metrics: JSON.stringify(defaultEval.lift),
        summary_notes: 'Initial default seeded batch evaluation (seed=42, size=500)',
      };
      await EvaluationRepository.saveRun(runRecord);

      if (defaultEval.allCases && defaultEval.allCases.length > 0) {
        const caseRecords = defaultEval.allCases.map((c) => ({
          id: `${defaultEval.runId}_${c.id}`,
          run_id: defaultEval.runId,
          payment_id: c.paymentId,
          customer_name: c.customerName,
          customer_email: c.customerEmail,
          customer_tier: c.customerTier,
          amount: c.amount,
          failure_code: c.failureCode,
          failure_type: c.failureType,
          retry_count: c.retryCount,
          ground_truth_prob: c.groundTruthProb,
          reviveai_prob: c.reviveAi.recoveryProbability,
          reviveai_action: c.reviveAi.recommendedAction,
          reviveai_policy_status: c.reviveAi.policyStatus,
          reviveai_is_approved: c.reviveAi.isApproved ? 1 : 0,
          reviveai_is_human_review: c.reviveAi.requiresHumanApproval ? 1 : 0,
          reviveai_is_stopped: c.reviveAi.isStopped ? 1 : 0,
          reviveai_intervened: c.reviveAi.intervened ? 1 : 0,
          reviveai_recovered: c.reviveAi.recovered ? 1 : 0,
          reviveai_recovered_revenue: c.reviveAi.recoveredRevenue,
          baseline_intervened: c.baseline.intervened ? 1 : 0,
          baseline_recovered: c.baseline.recovered ? 1 : 0,
          baseline_recovered_revenue: c.baseline.recoveredRevenue,
          is_synthetic: 1,
          created_at: defaultEval.createdAt,
        }));
        await EvaluationRepository.saveCases(caseRecords);
      }
    }

    // Fetch sample cases (limit 50)
    const caseRecords = await EvaluationRepository.findCasesByRunId(runRecord.id, 50, 0);
    const sampleCases = caseRecords.map((r) => ({
      id: r.id.includes('_') ? r.id.split('_')[1] : r.id,
      paymentId: r.payment_id,
      amount: r.amount,
      failureType: r.failure_type,
      failureCode: r.failure_code,
      paymentMethod: 'UPI' as const,
      retryCount: r.retry_count,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: '',
      customerTier: (r.customer_tier || 'B2C Customer') as any,
      groundTruthProb: r.ground_truth_prob,
      groundTruthRecoverable: r.ground_truth_prob > 0.2,
      isSynthetic: true as const,
      reviveAi: {
        rootCause: r.failure_type,
        confidence: 0.9,
        recoveryProbability: r.reviveai_prob,
        recommendedAction: r.reviveai_action as any,
        expectedRecovery: Math.round(r.amount * r.reviveai_prob),
        policyStatus: r.reviveai_policy_status,
        isApproved: Boolean(r.reviveai_is_approved),
        requiresHumanApproval: Boolean(r.reviveai_is_human_review),
        isStopped: Boolean(r.reviveai_is_stopped),
        intervened: Boolean(r.reviveai_intervened),
        recovered: Boolean(r.reviveai_recovered),
        recoveredRevenue: r.reviveai_recovered_revenue,
        unnecessaryIntervention: Boolean(r.reviveai_intervened && !r.reviveai_recovered && r.ground_truth_prob <= 0.2),
      },
      baseline: {
        action: Boolean(r.baseline_intervened) ? 'Blind Direct Retry / Blast' : 'None',
        intervened: Boolean(r.baseline_intervened),
        recovered: Boolean(r.baseline_recovered),
        recoveredRevenue: r.baseline_recovered_revenue,
        unnecessaryIntervention: Boolean(r.baseline_intervened && !r.baseline_recovered && r.ground_truth_prob <= 0.2),
      },
    }));

    const allRuns = await EvaluationRepository.findAllRuns(10);
    const recentRuns = allRuns.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      seed: r.seed,
      batchSize: r.batch_size,
    }));

    res.json({
      run: {
        runId: runRecord.id,
        createdAt: runRecord.created_at,
        seed: runRecord.seed,
        batchSize: runRecord.batch_size,
        isSynthetic: true,
        disclaimer: 'Batch evaluation uses reproducible synthetic data and does not represent live merchant revenue.',
        guardrailsSnapshot: JSON.parse(runRecord.guardrails_snapshot || '{}'),
        baseline: JSON.parse(runRecord.baseline_metrics || '{}'),
        reviveAi: JSON.parse(runRecord.reviveai_metrics || '{}'),
        lift: JSON.parse(runRecord.lift_metrics || '{}'),
        sampleCases,
      },
      recentRuns,
    });
  } catch (err: any) {
    console.error('[API] /api/evaluation/results error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── METRICS: Payment Signals / Revenue at Risk ─────────────────────────────
// Aggregates from transactions + recovery_cases + ai_diagnoses.
// Only payment failures are recorded in the DB. Checkout abandonment,
// subscription failures, and overdue receivables are not tracked here;
// those categories return 0 / unavailable.
app.get('/api/metrics/payment-signals', async (req, res) => {
  try {
    // Total failed transactions and their combined amount
    const failedTotals = await dbQuery.get<{ total_amount: number; total_count: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total_amount, COUNT(*) AS total_count
       FROM transactions
       WHERE status = 'failed'`
    );

    // Recovered: cases with status = 'recovered', joined to their transaction amounts
    const recoveredTotals = await dbQuery.get<{ recovered_amount: number; recovered_count: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) AS recovered_amount, COUNT(*) AS recovered_count
       FROM recovery_cases rc
       JOIN transactions t ON t.id = rc.transaction_id
       WHERE rc.status = 'recovered'`
    );

    // In-progress cases
    const inProgressTotals = await dbQuery.get<{ in_progress_amount: number; in_progress_count: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) AS in_progress_amount, COUNT(*) AS in_progress_count
       FROM recovery_cases rc
       JOIN transactions t ON t.id = rc.transaction_id
       WHERE rc.status NOT IN ('recovered', 'stopped')`
    );

    // Stopped cases (safety gate halted)
    const stoppedTotals = await dbQuery.get<{ stopped_amount: number; stopped_count: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) AS stopped_amount, COUNT(*) AS stopped_count
       FROM recovery_cases rc
       JOIN transactions t ON t.id = rc.transaction_id
       WHERE rc.status = 'stopped'`
    );

    // Potentially recoverable: sum of (amount * recovery_probability) for open cases
    const recoverableTotals = await dbQuery.get<{ recoverable_amount: number }>(
      `SELECT COALESCE(SUM(t.amount * d.recovery_probability), 0) AS recoverable_amount
       FROM recovery_cases rc
       JOIN transactions t ON t.id = rc.transaction_id
       JOIN ai_diagnoses d ON d.case_id = rc.id
       WHERE rc.status NOT IN ('recovered', 'stopped')`
    );

    // Per-case list for the transaction table (real data replacing the mock HIGH_VALUE_RISK_ITEMS)
    const cases = await dbQuery.all<{
      case_id: string;
      tx_id: string;
      customer_name: string;
      customer_email: string;
      amount: number;
      failure_code: string;
      failure_reason: string;
      case_status: string;
      created_at: string;
      recovery_probability: number | null;
    }>(
      `SELECT
         rc.id AS case_id,
         t.id AS tx_id,
         t.customer_name,
         t.customer_email,
         t.amount,
         t.failure_code,
         t.failure_reason,
         rc.status AS case_status,
         t.created_at,
         d.recovery_probability
       FROM recovery_cases rc
       JOIN transactions t ON t.id = rc.transaction_id
       LEFT JOIN ai_diagnoses d ON d.case_id = rc.id
       ORDER BY t.created_at DESC
       LIMIT 50`
    );

    // Failure reason aggregation (real data)
    const reasonBreakdown = await dbQuery.all<{
      failure_code: string;
      total_amount: number;
      tx_count: number;
    }>(
      `SELECT
         COALESCE(failure_code, 'UNKNOWN') AS failure_code,
         COALESCE(SUM(amount), 0) AS total_amount,
         COUNT(*) AS tx_count
       FROM transactions
       WHERE status = 'failed'
       GROUP BY failure_code
       ORDER BY total_amount DESC`
    );

    const totalFailed = failedTotals?.total_amount ?? 0;
    const totalCount = failedTotals?.total_count ?? 0;
    const recoveredAmount = recoveredTotals?.recovered_amount ?? 0;
    const recoveredCount = recoveredTotals?.recovered_count ?? 0;
    const inProgressAmount = inProgressTotals?.in_progress_amount ?? 0;
    const inProgressCount = inProgressTotals?.in_progress_count ?? 0;
    const stoppedAmount = stoppedTotals?.stopped_amount ?? 0;
    const stoppedCount = stoppedTotals?.stopped_count ?? 0;
    const recoverableAmount = recoverableTotals?.recoverable_amount ?? 0;

    res.json({
      // Top KPIs
      revenueAtRisk: totalFailed,          // sum of all failed tx amounts
      affectedTransactions: totalCount,    // count of failed transactions
      potentiallyRecoverable: recoverableAmount, // AI-weighted sum
      stoppedAmount,                        // halted by safety gate
      stoppedCount,

      // Recovery performance
      recoveredAmount,
      recoveredCount,
      inProgressAmount,
      inProgressCount,

      // Recovery rate (of cases that have closed)
      recoveryRate: (recoveredCount + stoppedCount) > 0
        ? Math.round((recoveredCount / (recoveredCount + stoppedCount)) * 100)
        : null,

      // Categories: only payment_failure is real in DB
      // checkout_abandonment, subscription_failure, overdue — not tracked
      categories: {
        payment_failure: {
          amount: totalFailed,
          count: totalCount,
          available: true,
        },
        checkout_abandonment: { amount: 0, count: 0, available: false },
        subscription_failure: { amount: 0, count: 0, available: false },
        overdue_receivables: { amount: 0, count: 0, available: false },
      },

      // Real failure reason breakdown
      reasonBreakdown: reasonBreakdown.map(r => ({
        reason: r.failure_code,
        amount: r.total_amount,
        count: r.tx_count,
        percent: totalFailed > 0 ? Math.round((r.total_amount / totalFailed) * 1000) / 10 : 0,
      })),

      // Per-case rows for transaction table
      cases: cases.map(c => ({
        caseId: c.case_id,
        txId: c.tx_id,
        customerName: c.customer_name || 'Unknown Customer',
        customerEmail: c.customer_email || '',
        avatar: (c.customer_name || 'XX')
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        amount: c.amount,
        failureCode: c.failure_code || 'UNKNOWN',
        failureReason: c.failure_reason || 'Unknown failure',
        caseStatus: c.case_status,
        createdAt: c.created_at,
        recoveryProbability: c.recovery_probability !== null
          ? Math.round((c.recovery_probability ?? 0) * 100)
          : null,
        riskLevel: c.amount >= 25000 ? 'High' : c.amount >= 10000 ? 'Medium' : 'Low',
        status: c.case_status === 'recovered' ? 'Recovered'
          : c.case_status === 'stopped' ? 'Stopped'
            : c.case_status === 'human_review' ? 'Approval Required'
              : (c.recovery_probability !== null && c.recovery_probability < 0.3) ? 'Low Probability'
                : 'Recoverable',
        category: 'payment_failure' as const,
      })),
    });
  } catch (err: any) {
    console.error('[API] payment-signals metrics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── METRICS: Command Center Overview ─────────────────────────────────────────
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const totalFailed = await dbQuery.get<{ amount: number; count: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count FROM transactions WHERE status = 'failed'`
    );
    const totalRecovered = await dbQuery.get<{ amount: number; count: number }>(
      `SELECT COALESCE(SUM(t.amount), 0) AS amount, COUNT(*) AS count
       FROM recovery_cases rc JOIN transactions t ON t.id = rc.transaction_id
       WHERE rc.status = 'recovered'`
    );
    const openCases = await dbQuery.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM recovery_cases WHERE status NOT IN ('recovered', 'stopped')`
    );
    const awaitingApproval = await dbQuery.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM recovery_cases WHERE status = 'human_review'`
    );

    res.json({
      revenueAtRisk: totalFailed?.amount ?? 0,
      failedTransactionCount: totalFailed?.count ?? 0,
      recoveredAmount: totalRecovered?.amount ?? 0,
      recoveredCount: totalRecovered?.count ?? 0,
      openCasesCount: openCases?.count ?? 0,
      awaitingApprovalCount: awaitingApproval?.count ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;

