# ReviveAI

## Governed Autonomous Revenue Recovery Agent

> **Detect revenue at risk. Diagnose the cause. Act within merchant-defined guardrails. Verify recovery. Measure the money recovered.**

**Razorpay AI Buildathon 2026 · Track 03 — AI Revenue Recovery**

---

## Overview

Revenue leakage does not end when a payment fails.

A failed payment can become lost revenue, customer churn, manual recovery work, or an unresolved receivable. The challenge is not only identifying the problem — it is deciding **what action should be taken, whether the merchant allows the agent to take it, and whether the recovery actually succeeded.**

**ReviveAI** is a governed autonomous revenue-recovery agent designed to close this loop.

It combines Gemini-powered diagnosis with deterministic merchant guardrails and Razorpay payment infrastructure.

```text
Revenue at Risk
      ↓
AI Diagnosis
      ↓
Recovery Decision
      ↓
Merchant Guardrails
      ↓
┌──────────────┬───────────────┬─────────────┐
│ Auto Recover │ Human Review  │    Stop     │
└──────────────┴───────────────┴─────────────┘
      ↓
Recovery Execution
      ↓
Payment Verification
      ↓
Audit Trail
      ↓
Measured Recovered Revenue
Why ReviveAI?

Traditional recovery workflows often look like:

Payment Failure
      ↓
Alert
      ↓
Operations Team
      ↓
Manual Investigation
      ↓
Manual Recovery

ReviveAI turns this into a governed agentic workflow:

Observe → Reason → Govern → Act → Verify → Audit → Measure

The key principle is:

Gemini reasons about the recovery opportunity. The deterministic policy engine decides whether the agent is authorized to act.

This enables autonomy without giving an LLM unrestricted control over merchant revenue.

System Architecture

The architecture is intentionally separated into four major layers:

Revenue Signals
ReviveAI Agent
Governance & Recovery Execution
Verification, Persistence & Measurement
Architecture principle
                 ┌─────────────────────────┐
                 │       GEMINI AI         │
                 │   Probabilistic Layer   │
                 │                         │
                 │ Diagnose + Reason       │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │     POLICY ENGINE       │
                 │   Deterministic Layer   │
                 │                         │
                 │ Merchant Authority      │
                 └────────────┬────────────┘
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
                AUTO        REVIEW       STOP

AI proposes. Policy authorizes. The system executes only within the merchant's boundaries.

The Governed Agent Loop

ReviveAI follows an eight-stage recovery loop:

Stage	What happens
1. Detect	Identify revenue at risk
2. Diagnose	Gemini determines root cause and recovery probability
3. Decide	Generate a recovery recommendation
4. Govern	Apply merchant-defined policies
5. Act	Auto-recover, request approval, or stop
6. Verify	Confirm payment through Razorpay
7. Audit	Record decisions and actions
8. Measure	Calculate actual recovered revenue
Merchant Guardrails

ReviveAI is designed around merchant-controlled autonomy.

Example configuration:

Guardrail	Demo Value
Maximum Auto-Recovery Amount	₹25,000
Minimum Recovery Probability	30%
Maximum Automated Retries	3
High-Value Recovery	Human Approval
Low-Confidence Recovery	Stop
Agent Mode	Auto Recover
Example: ₹5,000
Amount = ₹5,000
Recovery probability = above threshold
Auto-recovery limit = ₹25,000

             ↓

     POLICY ALLOWS ACTION

             ↓

        AUTO RECOVER
Example: ₹48,500
Amount = ₹48,500
Auto-recovery limit = ₹25,000

             ↓

       HIGH-VALUE CASE

             ↓

     HUMAN APPROVAL REQUIRED

The merchant can therefore choose how much autonomy the agent receives.

Agent Modes
Auto Recover

Eligible cases are executed automatically when all merchant guardrails are satisfied.

Review First

The agent diagnoses and prepares the recovery decision, but waits for merchant approval before execution.

Manual Only

The agent can identify and diagnose opportunities while recovery execution remains human-controlled.

AI Diagnosis

Gemini provides structured recovery intelligence:

Root cause
Confidence
Recovery probability
Recommended action
Expected recovery
Reasoning
Evidence

The AI diagnosis is then passed to the deterministic policy engine.

Payment Event
     ↓
Gemini
     ↓
Structured Diagnosis
     ↓
Policy Engine
     ↓
Merchant Authorization
     ↓
Action

This separation reduces the risk of allowing probabilistic model output to directly control sensitive financial actions.

Recovery Lifecycle

Each recovery case moves through a controlled state machine:

NEW
 ↓
DIAGNOSING
 ↓
SAFETY CHECKING
 ↓
 ├──────────────→ STOPPED
 │
 ├──────────────→ HUMAN REVIEW
 │                       ↓
 │                   AUTHORIZED
 │
 └──────────────→ AUTHORIZED
                        ↓
                       SENT
                        ↓
                    RECOVERED

A case is considered recovered only after the payment outcome is verified.

Verified Recovery

The prototype demonstrates an end-to-end Razorpay Test Mode recovery.

₹5,000 demonstration
Failed ₹5,000 Payment
        ↓
Gemini Diagnosis
        ↓
Merchant Guardrail Check
        ↓
Recovery Authorized
        ↓
Razorpay Test Mode Payment Link
        ↓
Payment Completed
        ↓
Razorpay Webhook
        ↓
Payment Verified
        ↓
₹5,000 RECOVERED

The important distinction is:

ReviveAI does not treat an AI prediction as recovered revenue. Recovery is measured after payment verification.

Revenue Leak Scenarios

ReviveAI's recovery pipeline supports multiple revenue-risk scenarios:

Payment Failure

A declined payment becomes a recovery opportunity.

Checkout Abandonment

A customer reaches checkout but does not complete payment.

Subscription Halt

A failed renewal places recurring revenue at risk.

Overdue Receivable

A receivable remains unpaid beyond its expected payment period.

The additional scenarios are currently represented through controlled demo inputs rather than being presented as production live integrations.

Recovery Sweep

ReviveAI measures recovery outcomes across recovery cases.

The dashboard tracks:

Revenue at Risk
Expected Recovery
Recovered Revenue
Recovery Rate
Cases Recovered
Human Review
Stopped Cases
Recovery Outcomes

The primary business outcome is:

How much revenue was actually recovered?

Audit Trail

Every important recovery event is recorded.

Case Created
     ↓
AI Diagnosis
     ↓
Policy Decision
     ↓
Authorization / Review
     ↓
Recovery Action
     ↓
Payment Verification
     ↓
Recovery Outcome

The audit trail provides visibility into:

What happened?
Why did the agent make the decision?
Which policy applied?
Was human approval required?
What action was taken?
Was the payment actually recovered?
Technology Stack
Layer	Technology
Frontend	React + Vite
Backend	Node.js + Express
Language	TypeScript
AI	Google Gemini
Database	SQLite
Payment Infrastructure	Razorpay
Payment Environment	Razorpay Test Mode
Payment Verification	Razorpay Webhooks
Project Structure
reviveai/
│
├── src/
│   ├── components/
│   │   ├── control/
│   │   │   └── RecoveryControlPage.tsx
│   │   ├── merchant/
│   │   │   └── MerchantOverviewPage.tsx
│   │   └── ...
│   │
│   ├── services/
│   │   └── aiDiagnosisService.ts
│   │
│   └── ...
│
├── server/
│   ├── services/
│   │   ├── recoveryService.ts
│   │   ├── geminiService.ts
│   │   ├── policyEngine.ts
│   │   └── razorpayService.ts
│   │
│   ├── app.ts
│   ├── db.ts
│   └── ...
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
Core API
GET  /api/health

POST /api/webhooks/razorpay

POST /api/checkout

POST /api/recovery/failures

GET  /api/recovery/cases

GET  /api/recovery/cases/:id

POST /api/recovery/cases/:id/approve

GET  /api/audit-trail
Local Setup
1. Clone
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd reviveai
2. Install dependencies
npm install
3. Configure environment

Create .env.local:

RAZORPAY_KEY_ID=your_test_key
RAZORPAY_KEY_SECRET=your_test_secret
GEMINI_API_KEY=your_gemini_api_key

Never commit .env.local.

4. Start backend
npm run server

Backend:

http://localhost:4000

Health check:

http://localhost:4000/api/health
5. Start frontend
npm run dev
Security

Secrets must never be committed to the repository.

Do not commit:

.env
.env.local
data.db
Razorpay secrets
Gemini API keys

Use .env.example for documenting required variables.

Prototype Scope

ReviveAI is a buildathon prototype.

Payment recovery is demonstrated using Razorpay Test Mode.
Some additional revenue-leak scenarios use controlled demo inputs.
Guardrail configuration is currently session-based.
Production messaging integrations are outside the current prototype scope.
Production deployment would require persistent configuration, production-grade data infrastructure, secrets management, observability, and additional security controls.

The prototype focuses on demonstrating the governed agentic recovery loop.

What Makes the Architecture Different?

ReviveAI is not designed as:

LLM → Payment Action

Instead:

LLM
 ↓
Diagnosis
 ↓
Deterministic Policy
 ↓
Merchant Authority
 ↓
 ┌────────────┬─────────────┐
 ↓            ↓             ↓
ACT         REVIEW         STOP
 ↓            ↓
 └──────┬─────┘
        ↓
Recovery
        ↓
Verification
        ↓
Audit + Metrics

This creates a controlled boundary between AI reasoning and financial execution.

Buildathon Positioning
Razorpay AI Buildathon 2026

Track 03 — AI Revenue Recovery

ReviveAI focuses on the complete revenue-recovery loop:

Detect → Diagnose → Decide → Govern → Act → Verify → Audit → Measure

The goal is not simply to predict which payments may fail.

The goal is to turn a revenue-risk event into a governed, measurable recovery workflow.

The ReviveAI Principle
Autonomous by default. Governed by design. Verified by outcome.

AI insights. Merchant control. Real recovery outcomes.

Built for Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery.


### Critical: why this version will look better on GitHub

Your previous README had the Mermaid block effectively rendered as ordinary text. **Do not remove the three backticks around the Mermaid architecture.**

It must literally begin like this in GitHub:

````markdown
```mermaid
flowchart TB
...

GitHub will render that as a **proper architecture diagram**, not the ugly text/arrow output in your screenshots.

Also, **delete the old 521-line README completely and replace it**. Don't append this underneath the existing content.

One more thing: your screenshots show the GitHub repo is already public. Before the final submissio
