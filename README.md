# Risk Intel - EndpointRiskAnalyzer

<p align="left">
  <a href="https://github.com/<OWNER>/<REPO>/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/<OWNER>/<REPO>/ci.yml?branch=main&label=build" alt="Build Status" />
  </a>
  <a href="https://github.com/<OWNER>/<REPO>/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/<OWNER>/<REPO>" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=111" alt="React" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/TailwindCSS-UI-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/ML-scikit--learn-F7931E?logo=scikitlearn&logoColor=white" alt="Scikit-learn" />
</p>

Risk Intel is a **CIS-aligned endpoint compliance and risk intelligence platform** that combines a Windows endpoint agent, FastAPI services, analytics dashboards, and ML-backed risk insights.

## Suggested Demo Media (Add These Early)

- `docs/assets/hero-overview.gif` -> 20-30 second product walkthrough (dashboard + live refresh)
- `docs/assets/scan-flow.gif` -> Trigger scan -> ingest -> analytics refresh animation
- `docs/assets/report-export.png` -> Organization report/PDF preview
- `docs/assets/endpoint-details.png` -> Endpoint comparison table + remediation focus

> **Pro-Tip:** Keep GIFs below ~12MB for fast loading on GitHub. Use 1280x720 and 10-15 FPS.

## Table of Contents

- [Project Overview](#project-overview)
- [Core Functionality](#core-functionality)
- [Tech Stack](#tech-stack)
- [Who This Is For](#who-this-is-for)
- [Repository Structure](#repository-structure)
- [Getting Started (From Scratch)](#getting-started-from-scratch)
- [Usage](#usage)
- [API Quick Examples](#api-quick-examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

EndpointRiskAnalyzer monitors endpoint posture, runs CIS-style checks, computes weighted compliance/risk, and exposes org-wide analytics for security and operations teams.

## Core Functionality

- **Endpoint Agent (Windows)**: Collects security posture, exposure, and CIS compliance signals.
- **Job-Driven Scanning**: Backend schedules scans; agents poll and submit results.
- **Risk Scoring & Prioritization**: Severity-weighted compliance scoring and priority action identification.
- **ML Analytics**: Isolation Forest + KMeans based anomaly/deviation signals.
- **Organization Analytics**: Live summaries, endpoint comparison, control-failure trends.
- **Reporting**: Organization-level JSON + PDF report endpoints.

## Tech Stack

- **Backend:** FastAPI, Uvicorn, PyMongo, SlowAPI, Pydantic
- **Frontend:** React (CRA), Recharts, Tailwind CSS, Framer Motion
- **Database:** MongoDB
- **Agent:** Python + PowerShell/Windows system interfaces
- **ML/Data:** scikit-learn, pandas, numpy

## Who This Is For

- Security engineering teams building endpoint risk visibility
- SOC / blue teams prioritizing remediation across fleets
- Students/researchers implementing applied cybersecurity analytics
- Open-source contributors interested in risk intelligence platforms

## Repository Structure

```text
EndpointRiskAnalyzer/
|- agent/                  # Endpoint data collector + job polling agent
|- backend/                # FastAPI API, services, routes, DB integration
|  |- db/main.py           # FastAPI app entrypoint
|  |- requirements.txt     # Backend dependencies (base)
|- frontend/               # React dashboard and analytics UI
|- scans/                  # Scan outputs/artifacts
|- ANALYTICS_README.md     # Analytics subsystem documentation
```

## Getting Started (From Scratch)

### 1. Install prerequisites

Install the following on your machine:

- `Git`
- `Python 3.10+`
- `Node.js 18+` and `npm`
- `MongoDB Community Server` (local instance)

> **Pro-Tip:** On Windows, ensure Python is added to PATH during installation.

### 2. Clone the repository

```bash
git clone https://github.com/<OWNER>/<REPO>.git
cd <REPO>/Main/EndpointRiskAnalyzer
```

### 3. Create and activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

### 4. Install Python dependencies

```powershell
pip install -r backend/requirements.txt
pip install python-dotenv slowapi reportlab bleach requests
```

### 5. Configure environment variables

```powershell
Copy-Item backend/.env.example backend/.env
```

Default values in `backend/.env.example`:

```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=org_security_posture_dev
```

### 6. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 7. Run MongoDB locally

Start MongoDB service using your OS method (e.g., Services panel on Windows, `mongod` on local shell).

## Usage

### Start backend API

```powershell
python -m uvicorn backend.db.main:app --host 127.0.0.1 --port 8000 --reload
```

- API root: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/health`

### Start frontend app

In a new terminal:

```powershell
cd frontend
npm start
```

- Frontend URL: `http://localhost:3000`

### Run endpoint agent

In another terminal:

```powershell
cd agent
python agent.py
```

Agent behavior:

- Registers endpoint via `/api/agent/register`
- Polls `/api/agent/jobs/{endpoint_id}` every 30s
- Runs scans on `RUN_SCAN` jobs
- Uploads scan payloads to `/api/scans/`

## API Quick Examples

### Trigger system-wide scan scheduling

```bash
curl -X POST http://127.0.0.1:8000/api/jobs/scan/all
```

### Fetch organization analytics/report

```bash
curl http://127.0.0.1:8000/api/report/organization
```

### Download organization PDF report

```bash
curl -L "http://127.0.0.1:8000/api/report/organization/pdf" -o org_report.pdf
```

## Troubleshooting

- **Mongo connection errors**: Confirm MongoDB is running and `MONGO_URI` is correct.
- **Module import errors**: Re-activate venv and re-run `pip install` steps.
- **Frontend cannot reach backend**: Verify backend is running on `127.0.0.1:8000`.
- **Agent auth failures (401)**: Re-run agent registration and verify stored API key.

> **Pro-Tip:** Keep three terminals open during development: backend, frontend, and agent.

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-change`
3. Commit with clear messages.
4. Push your branch and open a Pull Request.

Please include:

- Problem statement
- Scope of change
- Test evidence (logs/screenshots)
- Backward compatibility notes

## License

Choose one and add the corresponding `LICENSE` file:

- **MIT License** (recommended for permissive open-source adoption)
- **Apache-2.0 License** (recommended if patent grant/terms are needed)

Current badge and links are placeholders until license file is added.
