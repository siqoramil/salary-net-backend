# SalaryNet — Server

AI-powered expense tracker backend. Fastify + MongoDB + Redis + Google Gemini.

## Stack

- **Runtime:** Node.js ≥ 20, TypeScript
- **Framework:** Fastify 5 with `fastify-type-provider-zod`
- **Database:** MongoDB (Mongoose)
- **Cache / sessions:** Redis (ioredis)
- **Auth:** JWT access + refresh (`@fastify/jwt`, bcrypt)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Docs:** OpenAPI via `@fastify/swagger` + Scalar UI at `/docs`
- **Uploads:** `@fastify/multipart` + static hosting at `/static/`
- **OTP delivery:** Eskiz.uz SMS / SMTP email (dev falls back to server stdout)

## Project layout

```
src/
├── app.ts              # Fastify bootstrap, plugin + route registration
├── config/             # Env schema (zod)
├── constants/
├── db/                 # Mongo + Redis connections
├── models/             # Mongoose models (user, expense, budget, chat, otp)
├── plugins/            # Fastify plugins (jwt, auth)
├── routes/             # auth, users, expenses, chat, upload
├── schemas/            # Zod request/response schemas
├── services/           # Business logic (AI, OTP, etc.)
└── utils/
```

## Prerequisites

- Node.js ≥ 20
- Yarn
- Docker + Docker Compose (for MongoDB + Redis)

## Setup

```bash
# 1. Install dependencies
yarn install

# 2. Copy env template and fill in secrets
cp .env.example .env

# 3. Start MongoDB + Redis (from repo root)
cd .. && docker compose up -d

# 4. Run in dev mode (tsx watch, hot reload)
cd server && yarn dev
```

Server runs on `http://localhost:4000` by default.

- Health check: `GET /health`
- API docs (Scalar): `http://localhost:4000/docs`
- Static uploads: `http://localhost:4000/static/<file>`

## Environment variables

See `.env.example` for the full list. Key groups:

| Group | Variables |
|---|---|
| Server | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL` |
| Database | `MONGODB_URI` |
| Redis | `REDIS_URL` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` |
| Gemini AI | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| SMS (Eskiz.uz) | `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_BASE_URL`, `ESKIZ_SENDER` |
| Email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| CORS | `CORS_ORIGINS` (comma-separated) |
| Rate limiting | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW` |

In development, if Eskiz/SMTP credentials are missing, OTP codes and email links are printed to the server stdout so you can continue locally without real providers.

## Scripts

| Command | Description |
|---|---|
| `yarn dev` | Start with `tsx watch` (hot reload) |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled output from `dist/` |
| `yarn typecheck` | Type-check without emitting |
| `yarn lint` | ESLint over `src/**/*.ts` |
| `yarn test` | Run Vitest once |
| `yarn test:watch` | Vitest in watch mode |

## API surface

All routes are versioned under `/api/v1`:

- `POST /api/v1/auth/*` — signup, login, OTP, refresh, password reset
- `GET/PATCH /api/v1/users/*` — profile
- `CRUD /api/v1/expenses/*` — expense entries and budgets
- `POST /api/v1/chat/*` — Gemini-powered assistant
- `POST /api/v1/upload/*` — file uploads (multipart, 5 MB limit)

Browse the live schema at `/docs` while the server is running.

## Production

```bash
yarn build
NODE_ENV=production yarn start
```

Make sure strong `JWT_*` secrets, real `GEMINI_API_KEY`, and production-grade Mongo/Redis URIs are set.
