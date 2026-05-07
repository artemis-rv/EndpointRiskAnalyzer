# Endpoint Risk Analyzer — Technical Audit

---

## 1. HTTP vs HTTPS — TLS Configuration

### (a) Code Location
- [main.py:54-58](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/db/main.py#L54-L58) — HTTPS redirect middleware
- [main.py:60-66](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/db/main.py#L60-L66) — HSTS headers
- TLS cert files: `cert.pem` + `key.pem` exist in the project root

```python
# main.py L56-58
if os.getenv("ENFORCE_HTTPS", "false").lower() == "true":
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)
```

### (b) How It Works
- **Currently running HTTP** — uvicorn is started with `python -m uvicorn backend.db.main:app --reload` (no `--ssl-keyfile`/`--ssl-certfile` flags)
- HTTPS redirect is **opt-in** via `ENFORCE_HTTPS=true` env var (currently commented out in `.env`)
- HSTS header (`Strict-Transport-Security`) is **always injected** even over HTTP (line 63), which is technically incorrect but harmless in dev
- Self-signed certs (`cert.pem`, `key.pem`, `openssl.cnf`) exist but aren't passed to uvicorn

### (c) Problem It Solves
- TLS encrypts agent→backend traffic (scan data, API keys, HMAC signatures)
- HSTS prevents protocol downgrade attacks once HTTPS is established

### (d) Weaknesses & Improvements

| Issue | Severity | Fix |
|---|---|---|
| Running plain HTTP in dev — API keys travel in cleartext | **High** | Start uvicorn with `--ssl-keyfile key.pem --ssl-certfile cert.pem` |
| HSTS header sent over HTTP is ignored by browsers | Low | Only inject HSTS when `ENFORCE_HTTPS=true` |
| Self-signed certs won't work for production | Medium | Use Let's Encrypt or a reverse proxy (nginx/Caddy) for TLS termination |
| Agent hardcodes `http://127.0.0.1:8000` | **High** | Should read from env and default to `https://` |

---

## 2. HMAC — Signing, Verification, Storage

### (a) Code Locations
- **Generation (server-side):** [agent_jobs.py:13-15](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/agent_jobs.py#L13-L15)
- **Sent to agent:** [agent_jobs.py:57-67](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/agent_jobs.py#L57-L67) (poll response)
- **Verified (agent-side):** [agent.py:132-136](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/agent/agent.py#L132-L136)
- **Enforcement:** [agent.py:211-212](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/agent/agent.py#L211-L212)

### (b) How It Works

```
HMAC-SHA256( key = api_key, message = "{job_id}:{timestamp_iso}" )
```

1. Agent calls `POST /api/agent/poll` with Bearer token
2. Server finds a pending job, generates `signature = HMAC(api_key, job_id:timestamp)`
3. Returns `{ job_id, job_type, timestamp, signature }` to agent
4. Agent recomputes the HMAC locally using its stored API key and calls `hmac.compare_digest()`
5. If mismatch → job is **rejected** with "Security violation" log

### (c) Problem It Solves
- **Job Integrity Protection** — prevents a MITM from injecting fake `RUN_SCAN` jobs
- Ensures only the server that knows the API key could have authored the job dispatch

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| HMAC is **never stored in DB** — it's computed on-the-fly and returned in the HTTP response only | Info | By design (stateless verification) |
| Signature only covers `job_id:timestamp`, not `job_type` — attacker could theoretically change job_type in transit | Low | Include `job_type` in the signed message |
| No replay protection on the HMAC itself (same job polled twice = same signature if timestamp reused) | Low | Already mitigated by job status changing to `completed` after first execution |
| API key used as HMAC key is stored **plaintext** in DB and on agent disk (`.api_key` file) | **High** | Hash the key in DB; derive HMAC key from it |

---

## 3. Nonce — Full Lifecycle

### (a) Code Locations
- **Generated (agent-side):** [agent.py:124-125](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/agent/agent.py#L124-L125) — `uuid.uuid4()`
- **Sent as header:** [agent.py:129](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/agent/agent.py#L129) — `X-Nonce`
- **Validated + stored:** [api_auth.py:47-57](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/api_auth.py#L47-L57)
- **TTL index (auto-expire):** [mongo.py:111-119](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/db/mongo.py#L111-L119) — 120s TTL

### (b) How It Works

```
Agent                          Backend
  |-- X-Nonce: uuid4() -------->|
  |-- X-Timestamp: iso -------->|
                                 | 1. Check nonces collection for this nonce
                                 | 2. If found → 403 "replay attack detected"
                                 | 3. If not → insert { nonce, expires_at: now+10min }
                                 | 4. MongoDB TTL index auto-deletes after 120s
```

### (c) Problem It Solves
- **Anti-replay protection** — an intercepted request cannot be re-sent because the nonce is consumed on first use

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| Timestamp validation is **disabled** (lines 43-44: commented out) due to "VM clock drift" | **High** | Re-enable with a generous window (e.g., 600s) or use NTP |
| TTL index = 120s but nonce `expires_at` = now+10min (600s) — **mismatch**: nonce deleted from DB at 120s, but logically "valid" until 600s, creating a replay window between 120s-600s | **High** | Align: set `expires_at = now + timedelta(seconds=120)` to match TTL |
| Nonce check is **optional** — if headers missing, request proceeds (backward compat, line 33) | Medium | Make mandatory once all agents are updated |

---

## 4. API Keys — Creation, Storage, Validation

### (a) Code Locations
- **Created:** [agent_register.py:25](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/agent_register.py#L25) — `secrets.token_hex(32)` (64-char hex)
- **Stored in DB:** [agent_register.py:34](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/agent_register.py#L34) — plaintext in `endpoints.api_key`
- **Stored on agent:** [agent.py:247-248](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/agent/agent.py#L247-L248) — plaintext in `.api_key` file
- **Validated per request:** [api_auth.py:11-26](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/api_auth.py#L11-L26) — Bearer token lookup

### (b) How It Works

```
1. Agent POST /api/agent/register { endpoint_id, hostname, os }
2. Server generates secrets.token_hex(32) → 64-char key
3. Stored as plaintext in endpoints collection: { api_key: "abc123..." }
4. Returned to agent in response → agent saves to .api_key file
5. Every subsequent request: Authorization: Bearer <api_key>
6. api_auth.py does: endpoints_collection().find_one({"api_key": token})
7. If found → returns endpoint_id; if not → 401
```

### (c) Problem It Solves
- Authenticates agents so only registered endpoints can upload scans or poll for jobs
- Binds each request to a specific endpoint via `endpoint_id` ownership check

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| API key stored **plaintext** in MongoDB | **Critical** | Store `sha256(api_key)` in DB; compare hashes on auth |
| Registration endpoint has **no authentication** — anyone can register | **High** | Add a shared enrollment secret or admin approval flow |
| Key is returned in plaintext over HTTP (no TLS currently) | **High** | Enforce HTTPS for `/api/agent/register` |
| No key rotation mechanism | Medium | Add `/api/agent/rotate-key` endpoint |
| Linear scan `find_one({"api_key": token})` — no index | Low | Create index on `api_key` field |

---

## 5. JWT — Used or Not?

### (a) Answer: **NOT used anywhere in the codebase**

### (b) What Replaces Session Management
- **Agent auth**: Persistent API key (Bearer token) stored on disk — effectively a long-lived session token
- **Dashboard (browser)**: **No authentication at all** — all frontend API calls in `api.js` have zero auth headers
- **WebSocket**: Hardcoded `token=dashboard-client` string (line 21 of `websockets.py`)

### (c) Why No JWT
This is a single-org internal tool. The agents use API keys because they're long-running daemons, not browser sessions. The dashboard currently has no user login system.

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| Dashboard APIs are **completely unauthenticated** — anyone on the network can read all scan data | **Critical** | Add JWT-based admin login or at minimum Basic Auth |
| WebSocket auth bypass via hardcoded `"dashboard-client"` token | **High** | Replace with JWT validation |
| No session expiry for agents (API key lives forever until manually deleted) | Medium | Add key expiration + rotation |

---

## 6. SMTP — Why Used?

### (a) Code Location
- [contact.py:16-55](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/contact.py#L16-L55)

### (b) How It Works
- `POST /api/contact/` receives `{ name, email, message }` from the Contact Us page
- Input is sanitized with `bleach.clean()` (strips all HTML tags)
- Sends email via Gmail SMTP (TLS on port 587) using an App Password
- Email goes to the support team address configured in `.env`

### (c) Problem It Solves
- Provides a communication channel for users/admins to report issues or request support
- Avoids needing a ticketing system — leverages existing email infrastructure

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| Gmail App Password in `.env` plaintext | Medium | Use a secrets manager or vault |
| No rate limiting on contact endpoint | Medium | Add `@limiter.limit("3/minute")` |
| No email format validation (only checks non-empty) | Low | Add regex or Pydantic `EmailStr` validation |

---

## 7. WebSockets — Protocol & Upgrade

### (a) Code Locations
- **Server endpoint:** [websockets.py:64-81](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/backend/routes/websockets.py#L64-L81)
- **Client connection:** [Dashboard.jsx:77-84](file:///d:/E/VSCode%20programs/SEM%204/SGP%20-%20systemB/Main/EndpointRiskAnalyzer/frontend/src/pages/Dashboard.jsx#L77-L84)

### (b) How It Works

| Layer | Detail |
|---|---|
| **Protocol** | `ws://` (unencrypted) — hardcoded in Dashboard.jsx line 77 |
| **Path** | `/wss/dashboard` (misleading name — the path says "wss" but protocol is `ws://`) |
| **Upgrade** | Handled by FastAPI/Starlette's `@router.websocket()` decorator. The ASGI server (uvicorn) handles the HTTP→WebSocket upgrade automatically |
| **Auth** | Query param `?token=dashboard-client` — hardcoded bypass in `ConnectionManager.connect()` |
| **Events broadcast** | `scan_completed`, `posture_updated`, `job_created`, `agent_connected` |

### (c) Problem It Solves
- Real-time dashboard updates without polling — when a scan completes, the dashboard refreshes instantly

### (d) Weaknesses

| Issue | Severity | Fix |
|---|---|---|
| Using `ws://` not `wss://` — WebSocket traffic is unencrypted | **High** | Switch to `wss://` when TLS is enabled |
| Hardcoded `dashboard-client` token = no real auth | **High** | Validate a real session token |
| No heartbeat/ping-pong — stale connections accumulate | Medium | Add periodic ping in `ConnectionManager` |
| Path named `/wss/dashboard` implies secure but isn't | Low | Rename to `/ws/dashboard` |

---

## 8. End-to-End Latency Breakdown

### Pipeline: Agent Scan → Upload → ML Inference → DB Query → Dashboard Render

| Stage | Code | Latency | Big-O |
|---|---|---|---|
| **Agent scan** (Windows) | `agent.py:run_agent()` → day2 + d6 + d7 + d8 | **15-45s** (WMI calls, CIS checks are ~30 PowerShell commands) | O(C) where C = CIS controls (~30) |
| **Upload** | `POST /api/scans/` → `insert_one()` | **50-200ms** (single MongoDB insert + network) | O(1) |
| **ML model train** (if stale) | `ml_service.py:train_models()` | **200ms-2s** (fetches ALL scans, builds DataFrame, trains IsolationForest + KMeans) | **O(N)** where N = total scans ever stored |
| **ML predict** (per endpoint) | `ml_service.py:predict_risk()` | **1-5ms** per endpoint (feature extraction + model.predict) | O(1) per call |
| **Dashboard cache update** | `dashboard.py:update_dashboard_cache()` → `get_live_posture_summary()` | **O(E × Q)** — for each endpoint, finds latest scan + runs predict_risk | E = endpoints, Q = 2 DB queries per endpoint |
| **DB → Dashboard API** | `GET /api/dashboard/summary` | **<5ms** (returns in-memory cache) | O(1) |
| **Frontend render** | React state update + DOM paint | **50-100ms** | O(E) components |

### Scaling Bottlenecks

> [!WARNING]
> **`get_live_posture_summary()` is O(E²) in practice** — it calls `find_one()` per endpoint (N+1 query problem). With 100 endpoints, that's 100+ individual MongoDB queries per dashboard load. At 1000 endpoints this will be **multiple seconds**.

> [!WARNING]
> **`train_models()` fetches ALL scans** with `endpoint_scans_collection().find({}, {"scan_data": 1})` — no pagination, no limit. With 10,000 scan records, this loads all into memory as a Python list.

---

## 9. Temporary Data — Storage, TTL, Cleanup

| Data Type | Stored In | TTL | Cleanup Mechanism |
|---|---|---|---|
| **Nonces** | `nonces` collection | `expires_at`: now+10min | MongoDB TTL index at 120s (`nonce_ttl_index`) — **mismatch with 10min expires_at** |
| **Jobs (pending)** | `agent_jobs` collection | `expires_at`: now+2min (online) or now+30min (offline) | 1. `update_many` flips to `expired` on each `list_jobs()` call; 2. MongoDB TTL index at 300s post-`expires_at`; 3. `delete_many` removes completed/expired older than 2h |
| **Jobs (completed)** | `agent_jobs` collection | Stays 2 hours then hard-deleted | `delete_many` in `list_jobs()` and `schedule_scan_all()` |
| **Endpoint UUIDs** | Agent disk (`.endpoint_id` file) | **Permanent** — never expires | None (by design — persistent identity) |
| **API Keys** | Agent disk (`.api_key`) + MongoDB `endpoints.api_key` | **Permanent** — never expires | None (no rotation) |
| **Dashboard cache** | Python `_dashboard_cache` dict (in-memory) | Until next scan triggers `update_dashboard_cache()` | Overwritten on each call |
| **ML models** | Python globals `MODEL_IF`, `MODEL_KM` (in-memory) | Until `MODEL_IS_STALE = True` (set on each new scan) | Retrained on next `predict_risk()` call |
| **Posture snapshots** | `org_posture_snapshots` collection | **Permanent** — never cleaned | None — accumulates forever |

> [!CAUTION]
> `org_posture_snapshots` has **no cleanup** — every dashboard cache update inserts a new snapshot. With 3 endpoints scanned hourly, that's 72 snapshots/day growing indefinitely.

---

## 10. All DB Queries — Shape, Efficiency, Unsurfaced Data

### Query Catalog

#### `endpoints` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `list_endpoints()` | `.find()` (all) + per-endpoint `count_documents()` | Need full list + scan count | Use `$lookup` aggregation to join scan counts in one query |
| `get_endpoint_detail()` | `.find_one({"endpoint_id": id})` | Single lookup by UUID | Fine — add index on `endpoint_id` |
| `verify_api_key()` | `.find_one({"api_key": token})` | Auth lookup | **Add index on `api_key`** — currently full collection scan |
| `upsert_endpoint()` | `.find_one()` + `.update_one(upsert=True)` | Create-or-update pattern | Could use `.update_one(upsert=True)` alone |

#### `endpoint_scans` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `upload_scan()` | `.insert_one(scan_record)` | Single write | Fine |
| `get_scans_for_endpoint()` | `.find({"endpoint_id": eid}).sort("scan_time", -1)` | All scans for one endpoint | **Add compound index** `{endpoint_id: 1, scan_time: -1}` + add `.limit()` |
| `get_live_posture_summary()` | `.find_one({"endpoint_id": eid}, sort=[("scan_time", -1)])` × N endpoints | Latest scan per endpoint (N+1 problem) | **Use aggregation pipeline** with `$group` + `$last` |
| `get_training_data()` | `.find({}, {"scan_data": 1})` — **ALL scans** | ML training needs full dataset | Add `.limit(1000)` or use sampling. Only latest scan per endpoint needed |

#### `agent_jobs` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `list_jobs()` | `.find({"created_at": {"$gte": 24h_ago}}).sort("created_at", -1)` | Recent jobs only | Add compound index `{created_at: -1, status: 1}` |
| `poll_and_heartbeat()` | `.find_one({"endpoint_id": id, "status": "pending", "expires_at": {"$gt": now}})` | Find actionable job for this agent | Add compound index `{endpoint_id: 1, status: 1, expires_at: 1}` |
| `mark_job_complete()` | `.find_one({"job_id": id})` + `.update_one()` | Ownership check then update | Could use `.find_one_and_update()` atomically |
| `cleanup` | `.update_many(status pending, expires_at < now)` + `.delete_many(status completed/expired, created_at < 2h)` | Bulk cleanup | Fine — runs on each list_jobs call |

#### `org_posture_snapshots` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `get_latest_posture()` | `.find_one({}, sort=[("generated_at", -1)])` | Most recent snapshot | Fine — add index on `generated_at` |
| `list_all_postures()` | `.find().sort("generated_at", -1)` — **ALL snapshots** | History view | Add `.limit(50)` pagination |
| `update_dashboard_cache()` | `.insert_one(snapshot)` | Persist cache to DB | Fine but needs cleanup (grows forever) |

#### `nonces` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `verify_api_key()` | `.find_one({"nonce": nonce})` + `.insert_one()` | Check-then-insert for replay prevention | Use unique index on `nonce` + catch `DuplicateKeyError` (atomic) |

#### `org_interpretations` collection

| Route | Query | Why This Shape | Better Alternative |
|---|---|---|---|
| `get_latest_interpretation()` | `.find_one({}, sort=[("generated_at", -1)])` | Latest interpretation | Fine — add index |

### Data in DB Never Surfaced on Dashboard

| Collection | Field(s) | Why Not Shown |
|---|---|---|
| `endpoints` | `api_key` | Security — should never be exposed to frontend |
| `endpoints` | `_id` (ObjectId) | Internal; `endpoint_id` (UUID) used instead |
| `endpoint_scans` | `scan_data.system.mac_address`, `scan_data.system.ip_addresses` | Collected but not rendered in any component |
| `endpoint_scans` | `scan_data.privilege_posture` | Collected by agent day6 but no dashboard component displays it |
| `endpoint_scans` | `scan_data.software_inventory.programs[]` (full list) | Only `counts.total_unique` is used by ML; individual programs never listed |
| `endpoint_scans` | `scan_data.security.event_log_settings` | Collected but never displayed |
| `endpoint_scans` | `scan_data.runtimes` | Collected in day2 but unused |
| `org_posture_snapshots` | All historical snapshots beyond latest | `list_all_postures()` exists but no frontend page calls it |
| `org_interpretations` | Historical interpretations beyond latest | Only latest is fetched |
| `nonces` | Entire collection | Internal anti-replay; never surfaced |

---

## 11. Pentester Vulnerability & Logic Bugs Assessment

> [!CAUTION]
> **Executive Summary:** The system suffers from severe logic flaws that allow full authentication bypass, account takeover (impersonation), and trivial Denial of Service (DoS). The reliance on "security by obscurity" for administrative routes completely exposes the system to anyone with network access.

### VULN-01: API Key Leakage / Agent Impersonation (Critical)
- **Location**: `agent_register.py` (Lines 18-22)
- **Description**: The `/api/agent/register` endpoint is unauthenticated. When a request is made with an existing `endpoint_id`, the server retrieves and **returns the existing plaintext API key** in the response.
- **Exploitation**: An attacker can sniff the unencrypted WebSocket traffic to capture `agent_connected` events (which broadcast the `endpoint_id`), or simply guess UUIDs. By calling `/register` with a target's `endpoint_id`, the attacker instantly steals their API key, allowing them to upload forged scan data (e.g., claiming a machine is secure when it's compromised) or intercept jobs.
- **Remediation**: Remove the logic that returns existing API keys. If an endpoint is already registered, reject the request or require the *old* API key to rotate to a new one.

### VULN-02: Silent Fail in Anti-Replay Protection (High)
- **Location**: `api_auth.py` (Lines 32-33)
- **Description**: The `verify_api_key` function attempts to enforce Replay Protection using `X-Timestamp` and `X-Nonce` headers. However, the condition `if timestamp_str and nonce:` allows the request to proceed normally if *either* header is missing (intended for backward compatibility).
- **Exploitation**: An attacker who intercepts a valid HTTP request (which is currently unencrypted, see Section 1) can simply strip the `X-Timestamp` and `X-Nonce` headers from the payload and replay the request indefinitely.
- **Remediation**: Enforce the presence of these headers. Reject any request missing them with a `400 Bad Request`.

### VULN-03: Unauthenticated ML & DoS Vector (High)
- **Location**: `ml_routes.py`
- **Description**: The endpoints `POST /api/ml/train` and `GET /api/ml/predict/{endpoint_id}` completely lack the `Depends(verify_api_key)` authentication guard.
- **Exploitation**: An unauthenticated user can repeatedly hit `/api/ml/train`. Because `train_models()` fetches **all historical scans** into memory (O(N) complexity) to train the IsolationForest, spamming this endpoint will instantly exhaust server RAM and CPU, causing a Denial of Service.
- **Remediation**: Add `Depends(verify_api_key)` (or a dedicated admin auth guard) to all ML routes.

### VULN-04: Unauthenticated Administrative Actions (Critical)
- **Location**: `job_scheduler.py` & `dashboard.py`
- **Description**: Highly privileged administrative actions—such as listing all jobs, scheduling fleet-wide scans (`/api/jobs/scan/all`), and viewing the organizational security posture—are exposed without any authentication.
- **Exploitation**: Any user on the LAN can trigger a fleet-wide scan, potentially causing an internal network DDoS as all agents simultaneously run WMI queries and upload data. They can also read the entire vulnerability posture of the organization.
- **Remediation**: Implement a JWT-based Admin Authentication system for the dashboard and require an admin token for all `/api/jobs/` and `/api/dashboard/` routes.

### VULN-05: Missing Rate Limiting on Resource-Intensive Routes (Medium)
- **Location**: `agent_register.py`
- **Description**: The registration endpoint lacks the `@limiter.limit` decorator.
- **Exploitation**: Attackers can spam the endpoint to bloat the MongoDB `endpoints` collection and exhaust the server's entropy pool (`secrets.token_hex(32)`).
- **Remediation**: Apply strict rate limiting (e.g., `@limiter.limit("5/minute")`) to `/api/agent/register` and `/api/ml/train`.
