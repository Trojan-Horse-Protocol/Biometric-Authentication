# WebAuthn Biometric Authentication
## Project structure

```text
backend/   FastAPI application
frontend/  React + TypeScript + Vite application
```

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

Generate a secret to add into the `.env` file:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

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

---

## Run with Docker Compose

This starts the backend and frontend containers for local development. The frontend is served by Vite's development server; this Compose setup is not intended as a production deployment.

### Prerequisites

- Docker Desktop on Windows or macOS, or Docker Engine with the Docker Compose plugin on Linux
- Docker must be running
- Ports `5173` and `8000` must be available

Verify Docker and Compose are available:

```bash
docker --version
docker compose version
```

### Configure and start

From the repository root (the directory containing `docker-compose.yml`), create the environment file if you have not already created one:

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `SESSION_SECRET` in `.env` to a secure random value. For local use, leave `RP_ID`, `ORIGIN`, and `BACKEND_CORS_ORIGINS` set to the provided `localhost` values.

Build the images and start both services:

```bash
docker compose up --build
```

Open the frontend at <http://localhost:5173>. The backend health endpoint is at <http://localhost:8000/health>, and its interactive API documentation is at <http://localhost:8000/docs>.

Press `Ctrl+C` to stop the services. To start them in the background instead, run `docker compose up --build -d`; view their logs with `docker compose logs -f` and stop them with `docker compose down`.

For a public production deployment, use a production frontend server, HTTPS, and set the WebAuthn `RP_ID`, `ORIGIN`, and CORS origins to match your deployed domain. The development server and localhost settings above are not suitable for that use.
