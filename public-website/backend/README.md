# RiskIntel Public Website — Python Backend

Production-grade FastAPI backend for the RiskIntel public website.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 |
| Language | Python 3.12+ |
| Database | PostgreSQL 17 |
| ORM | SQLAlchemy 2.x (async) |
| Migrations | Alembic |
| Auth | JWT (HS256) + Argon2id |
| Validation | Pydantic v2 |
| Rate Limiting | slowapi (Redis-backed) |
| Caching | Redis 7 |
| Logging | structlog (JSON) |
| Container | Docker (multi-stage) |

---

## Folder Structure

```
backend/
├── app/
│   ├── api/v1/          ← Route handlers (thin, no business logic)
│   │   ├── admin/       ← ADMIN+ protected routes
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── releases.py
│   │   ├── downloads.py
│   │   ├── feedback.py
│   │   ├── contact.py
│   │   └── health.py
│   ├── core/            ← Config, security, logging, dependencies
│   ├── db/              ← Engine, session, base
│   ├── models/          ← SQLAlchemy ORM models
│   ├── schemas/         ← Pydantic v2 I/O schemas
│   ├── repositories/    ← Data access layer (all SQL here)
│   ├── services/        ← Business logic layer
│   ├── middleware/      ← Request ID, security headers, rate limit
│   ├── utils/           ← Email, audit logging, pagination
│   ├── tests/           ← pytest test suite
│   └── main.py          ← FastAPI app factory
├── alembic/             ← Database migrations
├── alembic.ini
├── Dockerfile
├── pyproject.toml       ← pytest config
├── requirements.txt
└── .env.example
```

---

## Quick Start (Local Development)

### 1. Create virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux/macOS
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
copy .env.example .env
# Edit .env with your local values
```

Minimum required settings:
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/riskintel_public
JWT_SECRET_KEY=<generate with: openssl rand -hex 64>
```

### 4. Run database migrations

```bash
alembic upgrade head
```

### 5. Start the development server

```bash
uvicorn app.main:app --reload --port 8080
```

API docs: http://localhost:8080/docs

---

## Docker Deployment

```bash
# From public-website/docker/
cp .env.example .env
# Edit .env with production values

docker compose up -d
```

The `website-migrate` service runs `alembic upgrade head` before the backend starts.

---

## Running Tests

```bash
# Install test dependencies (already in requirements.txt)
pytest

# With coverage
pytest --cov=app --cov-report=term-missing
```

---

## API Endpoints

### Authentication (`/api/v1/auth/`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register new user |
| POST | `/login` | Login, receive JWT tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/logout` | Revoke refresh token |
| POST | `/verify-email` | Verify email address |
| POST | `/request-password-reset` | Request reset email |
| POST | `/reset-password` | Complete password reset |

### Users (`/api/v1/users/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/me` | Any | Get own profile |
| PATCH | `/me` | Any | Update own profile |

### Releases (`/api/v1/releases/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | None | List published releases |
| GET | `/latest` | None | Get latest release |
| GET | `/{id}` | None | Get release by ID |

### Downloads (`/api/v1/downloads/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Verified | Record download |
| GET | `/me` | Verified | My download history |

### Feedback (`/api/v1/feedback/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Any | Submit feedback |
| GET | `/me` | Any | My feedback |

### Contact (`/api/v1/contact/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | Any | Submit contact request |
| GET | `/me` | Any | My contact requests |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/v1/admin/releases` | ADMIN+ | Manage releases |
| PATCH/DELETE | `/api/v1/admin/releases/{id}` | ADMIN+ | Update/delete release |
| GET/PATCH | `/api/v1/admin/feedback` | ADMIN+ | Manage feedback |
| GET/PATCH | `/api/v1/admin/contact` | ADMIN+ | Manage contacts |

### Health

| Endpoint | Description |
|---|---|
| `GET /health/live` | Process alive check |
| `GET /health/ready` | DB connectivity check |

---

## Security

- **Passwords**: Argon2id (64 MiB, time_cost=3)
- **JWT**: HS256, 15-minute access tokens, 7-day refresh tokens
- **Refresh rotation**: Single-use tokens, hashed storage
- **Rate limiting**: 10 req/min for auth, 100 req/min default
- **Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **CORS**: Strict allowlist from `CORS_ORIGINS` env var
- **Request size**: 1 MB limit
- **Audit logging**: All auth events and admin actions logged as structured JSON

---

## Environment Variables

See [`.env.example`](.env.example) for full reference.

Critical variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:port/db` |
| `JWT_SECRET_KEY` | Random 64+ char hex string |
| `REDIS_URL` | Redis connection string |
| `CORS_ORIGINS` | Comma-separated allowed origins |
