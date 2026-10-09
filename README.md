# WebAuthn Biometric Authentication
## Project structure

```text
backend/   FastAPI application
frontend/  React + TypeScript + Vite application
```

The current starter only includes a health check and a basic frontend page. WebAuthn registration, authentication, database persistence, and security controls will be added in later tasks.

## Prerequisites

- Python 3.10 or newer
- Node.js 20 or newer
- npm

## 1. Clone and enter the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

## 2. Configure environment variables

Copy `.env.example` to `.env` in the repository root.

On macOS/Linux:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not commit `.env`. It is ignored by Git.

## 3. Start the FastAPI backend

From the repository root:

```bash
python -m venv .venv
```

Activate the virtual environment.

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install backend dependencies and start the server:

```bash
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

The backend will be available at:

- Health endpoint: http://localhost:8000/health
- Interactive API documentation: http://localhost:8000/docs

## 4. Start the React frontend

Open a second terminal in the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173.

The frontend includes a button that checks the backend health endpoint.

## Development workflow

1. Create a branch for a Jira task.
2. Make a small change.
3. Run the backend and frontend locally.
4. Open a pull request for review.
5. Include the Jira task key in the pull request title.

Example branch:

```text
WEBAUTHN-8-fastapi-health-endpoint
```

## Current limitations

- No WebAuthn registration or authentication yet
- No database yet
- No user accounts or roles yet
- No production deployment yet
- The backend currently allows the local Vite development origin only
