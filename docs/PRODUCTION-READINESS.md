# LendLoop — Production Readiness & Operational Runbook

> **Document Classification:** DevOps & Site Reliability Engineering (SRE)  
> **Deployment Target:** Vercel (Next.js Frontend) + Convex Cloud (Backend/DB) + Self-Hosted / Managed n8n  

---

## 1. Production Architecture & Infrastructure Topology

```
[ Internet ]
     │
     ├── HTTPS ──► [ Vercel Edge Network / CDN ] ──► [ Next.js 15 App Router ]
     │                                                         │
     │                                                    Convex WebSocket
     │                                                         │
     ├── HTTPS ──► [ Convex Global Edge ] ──────────────► [ Convex Functions & DB ]
     │                                                         │
     │                                                  Internal Outbox Action
     │                                                         │
     └── HTTPS ──► [ Reverse Proxy (Caddy/Traefik) ] ──► [ Dockerized n8n Engine ]
```

---

## 2. Operational Health & Monitoring

### 2.1 Core Metrics & Observability
- **Frontend (Next.js):**
  - Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1).
  - Vercel Analytics & Speed Insights.
  - Sentry / Datadog for client-side exception capture.
- **Backend (Convex Cloud):**
  - Function Execution Latency (P50, P95, P99).
  - Transaction Conflict & Abort Rate (< 0.01%).
  - Outbox Dispatch Queue Depth & Retry Lag.
  - Storage & Document I/O bandwidth.
- **Automation (n8n):**
  - Webhook response latency (< 250ms).
  - Execution success vs failure count per workflow.
  - Docker container CPU, Memory, and Disk usage via Docker Healthcheck.

### 2.2 Alerting Thresholds
| Metric | Warning Threshold | Critical Threshold | Notification Channel |
|---|---|---|---|
| Unhandled Convex Errors | > 5 per minute | > 20 per minute | PagerDuty / Ops Slack |
| Outbox Queue Age | > 5 minutes | > 15 minutes | Ops Slack |
| n8n Failed Executions | > 3 consecutive | > 10 in 1 hour | PagerDuty / Ops Slack |
| Webhook HMAC Failures | > 5 in 10 minutes | > 25 in 10 minutes | Security Alert Channel |
| Database Storage Capacity | > 75% | > 90% | Ops Email |

---

## 3. Disaster Recovery & Backup Strategy

### 3.1 Convex Backup Policy
- **Automated Point-in-Time Recovery (PITR):** Continuous WAL archiving enabled in production.
- **Scheduled Daily Snapshots:** Automated nightly export of document state to secondary encrypted cloud storage bucket (AWS S3 / GCP Cloud Storage).
- **RTO (Recovery Time Objective):** < 1 hour.
- **RPO (Recovery Point Objective):** < 5 minutes.

### 3.2 n8n Workflow State & Database Backup
- Workflows are committed to Git as sanitized declarative JSON (`n8n/workflows/*.json`).
- If n8n runs with PostgreSQL backend (`docker-compose.yml`), daily `pg_dump` runs on a scheduled cron with retention of 30 days.

---

## 4. Rate Limiting & Abuse Prevention

1. **Authentication Limits:** Clerk enforces native rate limiting against brute-force login and credential stuffing.
2. **Public Search & Catalog Endpoint:** Convex query caching protects database throughput. Client-side debouncing limits search query rate.
3. **Borrow Request Throttling:** Convex mutation verifies user does not exceed 5 pending borrow requests concurrently.
4. **Webhook Rate Limiting:** n8n ingress protected by reverse proxy rate limits (max 60 requests/minute per source IP).

---

## 5. Secrets Management & Rotation Policy

| Secret Name | Storage Location | Rotation Cadence | Rotation Procedure |
|---|---|---|---|
| `CLERK_SECRET_KEY` | Clerk Dashboard & Vercel Env | 90 days | Generate new API key in Clerk, update Vercel, revoke old key |
| `CONVEX_DEPLOY_KEY` | Convex Dashboard & CI Secrets | 90 days | Generate in Convex console, update CI, revoke previous |
| `CONVEX_N8N_HMAC_SECRET` | Convex & n8n Env | 180 days | Update n8n to accept dual secrets during grace window, then rotate Convex |
| `N8N_CONVEX_WRITEBACK_SECRET`| n8n & Convex Env | 180 days | Update Convex to accept dual secrets, rotate n8n, finalize Convex |
| `N8N_ENCRYPTION_KEY` | n8n Docker Environment | Permanent | Backed up securely in vault; change requires workflow re-encryption |

---

## 6. Incident Response Runbook

### Scenario A: Outbox Processing Stalled
1. Inspect Convex logs for `automation:dispatchPendingEvents`.
2. Check if n8n container is healthy: `docker compose ps` and `docker compose logs -n 100 n8n`.
3. Check `CONVEX_N8N_WEBHOOK_URL` reachability.
4. If events stuck in `processing`: invoke `automation:recoverStaleProcessingEvents`.
5. If events repeatedly fail: inspect `automationEvents.lastError` for specific HMAC or network errors.

### Scenario B: Suspected Compromised Webhook Secret
1. Immediately generate new 256-bit cryptographically secure secret (`openssl rand -hex 32`).
2. Update `CONVEX_N8N_HMAC_SECRET` in Convex environment variables.
3. Update `CONVEX_N8N_HMAC_SECRET` in n8n container environment variables (`docker-compose.yml` or `.env`).
4. Restart n8n container: `docker compose restart n8n`.
5. Review audit logs for unauthorized write-backs during incident window.
