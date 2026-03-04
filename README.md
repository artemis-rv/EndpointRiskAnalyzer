<div align="center">

  <!-- <picture>
    <img src="header.svg" width="100%" alt="Risk Intel Banner" />
  </picture> -->
  # Risk Intel <br> 
  ### EndpointRiskAnalyzer

  <p>
    An intelligent, agent-based platform for evaluating endpoint security posture using CIS benchmarks, ML-assisted risk scoring, and real-time visualization.
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a>
  </p>

</div>

---

## ✨ Features

- **Real-Time Visibility:** Background agents provide live endpoint telemetry (OS info, system configurations) directly to the dashboard.
- **CIS Compliance Benchmarking:** Automatically scans endpoints against CIS (Center for Internet Security) standards to detect vulnerabilities and misconfigurations.
- **ML-Assisted Risk Analysis:** Evaluates raw system data utilizing Machine Learning to calculate Anomaly Scores and consolidate Organization-Wide Security Posture grades.
- **Network Auditing:** Identifies high-risk open ports and monitors active network exposures.
- **Secure Transport Architecture:** 
  - **HTTPS & WSS:** Fully encrypted API traffic.
  - **Anti-Replay Protection:** Cryptographic Nonces and Timestamps prevent MITM replay attacks.
  - **Job Integrity:** HMAC-SHA256 signatures guarantee agents only execute verified server instructions.

---

## 💻 Tech Stack

<div align="center">
  <table align="center" style="border: none; background: transparent;">
    <tr>
      <td align="center" width="25%">
        <strong>Frontend</strong><br><br>
        <img src="https://skillicons.dev/icons?i=react,tailwind" alt="React & Tailwind" /><br>
        <sub>React, TailwindCSS, Framer Motion</sub>
      </td>
      <td align="center" width="25%">
        <strong>Backend</strong><br><br>
        <img src="https://skillicons.dev/icons?i=fastapi,python" alt="FastAPI & Python" /><br>
        <sub>FastAPI, WebSockets, Python 3.10+</sub>
      </td>
      <td align="center" width="25%">
        <strong>Database</strong><br><br>
        <img src="https://skillicons.dev/icons?i=mongodb" alt="MongoDB" /><br>
        <sub>MongoDB (Atlas / Local)</sub>
      </td>
      <td align="center" width="25%">
        <strong>Agent</strong><br><br>
        <img src="https://skillicons.dev/icons?i=windows" alt="Windows" /><br>
        <sub>Python, Psutil, WMI</sub>
      </td>
    </tr>
  </table>
</div>

---

## 🏗️ Architecture

1. **Endpoint Agent:** A lightweight Windows-compatible Python script (`agent.py`) that runs silently on target machines. It establishes an authenticated, encrypted polling cycle with the central server.
2. **FastAPI Backend:** Orchestrates endpoint registration, job distribution (e.g., initiating scans), database writes to MongoDB, and serves the Machine Learning analysis module.
3. **React Dashboard:** A premium, real-time UI mapping and WebSockets to display immediate systemic interpretations.

---

## 🚀 Getting Started

Follow these steps to deploy Risk Intel on your network.

### Prerequisites
- **Python 3.10+** (Added to PATH)
- **Node.js 18+** & npm
- A **MongoDB** instance (Local or Atlas cluster)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/EndpointRiskAnalyzer.git
cd EndpointRiskAnalyzer
```

### 2. Configure Environment Variables

> **⚠️ Security Note:** Do not commit `.env` files. Ensure they remain listed in `.gitignore`.

**Backend (`backend/.env`)**
Create a `.env` file in the `backend/` directory:
```env
# Database
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=risk_intel_db

# Security
ENFORCE_HTTPS=true
# Comma-separated list of EXACT URLs where the frontend is hosted
CORS_ORIGINS=http://localhost:3000,http://<YOUR_LAN_IP>:3000
```

**Frontend (`frontend/.env`)**
Create a `.env` file in the `frontend/` directory pointing to your backend:
```env
# Point this to your backend IP/Port
REACT_APP_API_URL=http://<YOUR_LAN_IP>:8000
REACT_APP_WS_URL=ws://<YOUR_LAN_IP>:8000/wss/dashboard
```

### 3. Start the Backend

Open a terminal in the project root:
```bash
# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# Install requirements
pip install -r requirements.txt

# Start the FastAPI Server (accessible network-wide)
python -m uvicorn backend.db.main:app --host 0.0.0.0 --port 8000
```
*(For production HTTPS setup, provide `--ssl-keyfile` and `--ssl-certfile` via uvicorn parameters)*

### 4. Start the Frontend Dashboard

Open a new terminal in the `/frontend` directory:
```bash
cd frontend
npm install
npm start
```
The application UI will compile and open at `http://localhost:3000`.

### 5. Deploy the Endpoint Agent

To monitor a Windows machine, alter the `agent.py` configuration to map to your central analytical server.

1. Open `agent/agent.py`.
2. Update the `BACKEND_URL` variable exactly:
   ```python
   BACKEND_URL = "http://<YOUR_BACKEND_LAN_IP>:8000"
   ```
3. Run the agent natively or build it into an executable:
   ```bash
   cd agent
   python agent.py
   
   # Optional: Compile to portable .exe
   # pip install pyinstaller
   # pyinstaller --onefile --name RiskIntelAgent agent.py
   ```

You will now see the agent appear actively polling on the frontend Dashboard!

---

