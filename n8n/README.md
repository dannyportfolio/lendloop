# LendLoop — n8n Automation Engine & Workflows

> **Subsystem:** Event-Driven Automation & Scheduled Background Processing  
> **Workflows Included:** Request Notifications, Overdue Reminders, Global Error Handler  

---

## 1. Overview

LendLoop delegates asynchronous communication, notifications, and scheduled reminders to an **n8n** automation instance running via Docker Compose.

The integration relies on two unidirectional trust mechanisms:
1. **Convex to n8n (Webhook Dispatches):** Authenticated with HMAC SHA-256 signatures, millisecond timestamp verification (5-minute tolerance), and unique event IDs to prevent replay attacks.
2. **n8n to Convex (Delivery Write-Backs & Overdue Queries):** Authenticated via a dedicated Bearer token (`N8N_CONVEX_WRITEBACK_SECRET`) hitting segregated Convex HTTP actions.

---

## 2. Quick Start with Docker Compose

To boot n8n locally:

```bash
# 1. Start n8n container in background
docker compose up -d n8n

# 2. Verify container health status
docker compose ps
docker compose logs -f n8n
```

Once running, access the n8n UI at `http://localhost:5678`.

---

## 3. Workflow Specifications

### Workflow A: Request Notifications (`n8n/workflows/request-notification.json`)
- **Trigger:** Webhook receiver at `POST http://localhost:5678/webhook/borrow-request`.
- **Security Check:** Computes `HMAC_SHA256(timestamp + "." + eventId + "." + rawBody)` and compares with `X-LendLoop-Signature` using `crypto.timingSafeEqual`. Validates timestamp within 300,000ms.
- **Action:** Formats notification for the lender (or borrower) with tool details and date range.
- **Write-Back:** POSTs back to `{{ CONVEX_SITE_URL }}/api/automation/writeback` with `{ eventId, status: "succeeded" }`.

### Workflow B: Scheduled Overdue Reminders (`n8n/workflows/overdue-reminders.json`)
- **Trigger:** Daily Cron schedule at `08:00 UTC` (`0 8 * * *`).
- **Fetch:** GET `{{ CONVEX_SITE_URL }}/api/loans/overdue` with Bearer auth.
- **Idempotency:** Generates key `overdue-{loanId}-{YYYY-MM-DD}` to guarantee borrower receives at most 1 reminder per day.
- **Action:** Sends reminder message to borrower.
- **Write-Back:** POSTs to `{{ CONVEX_SITE_URL }}/api/loans/reminders/record` with `idempotencyKey`.

### Workflow C: Global Error Handler (`n8n/workflows/error-handler.json`)
- **Trigger:** Error Trigger node attached to all execution errors.
- **Action:** Captures failed node, workflow ID, execution error stack, and dispatches an incident alert to operational logs.

---

## 4. Importing Workflows into n8n

1. Open `http://localhost:5678` in your browser.
2. In the left navigation, click **Workflows** -> **Add Workflow**.
3. In the top-right menu (`...`), select **Import from File**.
4. Choose the corresponding JSON file from `n8n/workflows/`:
   - `request-notification.json`
   - `overdue-reminders.json`
   - `error-handler.json`
5. Click **Save** and toggle the workflow state to **Active**.
