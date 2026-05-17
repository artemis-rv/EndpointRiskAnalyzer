<div align="center">

  # 🛡️ Risk Intel 
  ### Endpoint Risk Analyzer

  <p>
    An intelligent, agent-based platform for evaluating endpoint security posture using CIS benchmarks, ML-assisted risk scoring, and real-time visualization.
  </p>

  <p>
    <a href="#-key-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-security-posture">Security</a> •
    <a href="#-getting-started">Getting Started</a>
  </p>

</div>

---

## 🌟 Key Features

- **Real-Time Visibility:** Background agents (Python) stream live system configuration data, network states, and OS details directly to the central server.
- **CIS Benchmarking:** Automatically maps endpoint settings against **Center for Internet Security (CIS)** standards to pinpoint misconfigurations and vulnerabilities.
- **ML Risk Assessment:** Built-in Machine Learning models calculate Anomaly Scores and grade the overall organizational security health based on aggregated endpoint telemetry.
- **Secure Architecture:** Complete TLS enforcement. All traffic flows through an Nginx reverse proxy using `HTTPS` and `WSS` (Secure WebSockets), with strict agent-side certificate pinning to prevent Man-in-the-Middle (MITM) attacks.

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
        <strong>Agent / Infra</strong><br><br>
        <img src="https://skillicons.dev/icons?i=windows,nginx" alt="Windows & Nginx" /><br>
        <sub>Python, Psutil, Nginx</sub>
      </td>
    </tr>
  </table>
</div>

---

## 🏗️ Architecture

Risk Intel is built using a modern, decoupled microservices approach:

1. **Agent (`/agent`)**: A lightweight Windows-compatible Python script. It securely polls the backend to receive scan jobs, executes them locally (using `psutil` and `wmi`), and uploads the encrypted results.
2. **Backend (`/backend`)**: A **FastAPI** application. Orchestrates endpoint registration, manages MongoDB database writes, executes machine learning inference, and handles real-time WebSocket communication.
3. **Frontend (`/frontend`)**: A premium **React & TailwindCSS** dashboard. Visualizes live organizational security posture, interactive charts, and endpoint-specific metrics.
4. **Infrastructure (`/infra`)**: An **Nginx** reverse proxy that serves as the entry point, providing SSL/TLS termination, port routing, and HTTP-to-HTTPS redirection.

---

## 🔒 Security Posture

Risk Intel is engineered with a **"Secure-by-Default"** philosophy:
- **Strict Certificate Pinning**: The agent explicitly verifies the Nginx server's pinned TLS certificate (`verify=CERT_PATH`), immediately dropping any spoofed or MITM connections.
- **HMAC Signatures**: Server-issued scan jobs are cryptographically signed using HMAC-SHA256, ensuring agents only execute verified server instructions.
- **HSTS Enforcement**: Browsers and clients are forced to use secure channels, and WebSockets dynamically upgrade to `wss://`.

---

## 🚀 Getting Started

Follow these steps to deploy Risk Intel locally or on your internal network.

### Prerequisites
- **Python 3.10+** (Added to PATH)
- **Node.js 18+** & npm
- A **MongoDB** instance (Local or Atlas cluster)
- **Nginx** (via WSL, Docker, or native)

### 1. Configure the Backend (FastAPI)
Navigate to the `backend/` directory and create a `.env` file:
```env
# Database
MONGO_URI=mongodb://localhost:27017  # Or your MongoDB Atlas URI
DB_NAME=db_name

# Security & CORS
ENFORCE_HTTPS=true
CORS_ORIGINS=http://localhost:3000,https://localhost
```
Install dependencies and run the server:
```bash
python -m venv venv
venv\Scripts\activate      # On Windows
# source venv/bin/activate # On macOS/Linux

pip install -r requirements.txt
python -m uvicorn backend.db.main:app --host 0.0.0.0 --port 8000
```

### 2. Configure the Frontend (React)
Navigate to the `frontend/` directory and create a `.env` file:
```env
# Point to your Nginx proxy domain/IP
REACT_APP_API_URL=https://localhost
REACT_APP_WS_URL=wss://localhost/wss/dashboard
```
Install and run the dashboard:
```bash
cd frontend
npm install
npm start
```
*(Note: Use `$env:HOST="0.0.0.0"; npm start` on Windows if hosting alongside WSL Nginx).*

### 3. Start Nginx Reverse Proxy (HTTPS)
Risk Intel requires HTTPS for secure agent communication.
1. Ensure your SSL certificates (`dev.crt`, `dev.key`) are generated in the `infra/certs/` folder.
2. Copy or link the Nginx configuration located at `infra/nginx/riskintel.dev.conf` into your Nginx `sites-available` folder.
3. Restart Nginx (`sudo service nginx restart`).

### 4. Deploy the Agent
The agent runs directly on the endpoint machine you want to monitor.
1. Navigate to the `agent/` directory.
2. In `agent/agent_config/.env`, configure the backend URL to point to your Nginx proxy:
```env
BACKEND_URL=https://localhost
```
3. Run the agent:
```bash
python agent.py
```
*The agent will establish a secure handshake, register itself, and await scan jobs from your React dashboard!*

---

## 📄 License & Terms

This project is source-available software intended for educational, research, and non-commercial purposes.
Commercial usage, resale, managed hosting, or redistribution is prohibited without explicit permission.
See `LICENSE` and `TERMS.md` for details.
