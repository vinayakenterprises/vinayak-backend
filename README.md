# Scalable Node.js + PostgreSQL Backend (Express)

This is a production-grade, highly scalable boilerplate for building Node.js backends using Express and PostgreSQL.

## Architecture

This project is built using a **Layered Clean Architecture** pattern. This separates business logic from data access and transport layers:

- **Config Layer (`src/config`)**: Holds configuration objects for environment variables (`env.js`) and third-party setups (`database.js`).
- **Controllers (`src/controllers`)**: Responsible for handling incoming HTTP requests, extracting query/body parameters, validating payloads, and responding with standard JSON envelopes.
- **Services (`src/services`)**: Holds the core business logic. Contains domain workflows and orchestrates data transitions.
- **Repositories (`src/repositories`)**: Responsible for direct data access, handling SQL query transactions.
- **Middlewares (`src/middlewares`)**: Express interceptors for auth, request parsing, logging, and unified error handling.
- **Routes (`src/routes`)**: Defines entry end-points, versioning API structures (`/api/v1/...`), and maps routes to appropriate controllers.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) (running locally or remotely)

---

## Getting Started

### 1. Install Dependencies

In the root directory of the project, run:

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to create a `.env` file:

```bash
cp .env.example .env
```

Configure your PostgreSQL database connection variables in `.env`:

```env
PORT=3000
NODE_ENV=development

DB_USER=your_postgres_user
DB_HOST=your_postgres_host
DB_DATABASE=your_postgres_db
DB_PASSWORD=your_postgres_password
DB_PORT=5432
```

### 3. Run the Server

#### Development Mode (with hot-reloading using `nodemon`)

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

---

## Health Check API

Once the server is running, you can hit the `/api/v1/health` endpoint to verify the server status and database connectivity:

```bash
curl http://localhost:3000/api/v1/health
```

### Sample Response (Healthy)
```json
{
  "status": "success",
  "message": "Service is healthy",
  "data": {
    "server": "healthy",
    "database": "healthy",
    "uptime": 2.45,
    "timestamp": "2026-06-02T10:00:00.000Z"
  }
}
```

### Sample Response (DB Down / Connection Failed)
```json
{
  "status": "error",
  "message": "Service is partially degraded (Database connection failed)",
  "data": {
    "server": "healthy",
    "database": "unhealthy",
    "uptime": 1.22,
    "timestamp": "2026-06-02T10:00:00.000Z",
    "dbError": "connect ECONNREFUSED 127.0.0.1:5432"
  }
}
```
