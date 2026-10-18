# Stride — Business Operations Platform

A multi-tenant SaaS platform for managing employees, projects, tickets, and attendance with role-based access control.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Ant Design, TanStack Query, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | Short-lived JWT in HttpOnly cookies with CSRF protection |

## Prerequisites

- Node.js 20+
- PostgreSQL 16+

## Setup

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate deploy
ALLOW_INSECURE_DEMO_SEED=true npx prisma db seed # disposable local database only
npm run dev                   # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm install
npm run dev                   # http://localhost:3000
```

## Roles & Permissions

| Role | Create Employees | Manage Tickets | Finance | Org Settings |
|------|-----------------|----------------|---------|--------------|
| FOUNDER | ✅ | ✅ | ✅ | ✅ |
| CPO | ✅ | ✅ | — | ✅ |
| CFO | — | ✅ | ✅ | ✅ |
| HR | ✅ | ✅ | — | ✅ |
| MANAGER | ✅ | ✅ | — | — |
| TEAM_LEAD | — | ✅ | — | — |
| EMPLOYEE | — | Own only | Own only | — |

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stride_db
JWT_SECRET=your-secret-at-least-32-characters-long
JWT_EXPIRES_IN=15m
JWT_ISSUER=stride-api
JWT_AUDIENCE=stride-web
ENCRYPTION_KEY=replace-with-64-hexadecimal-characters
PORT=4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## API Health Check

```
GET /health
→ { "status": "ok", "ts": "2026-01-01T00:00:00.000Z" }
```

## Deployment

1. Set `NODE_ENV=production` on the server.
2. `JWT_SECRET` must be at least 32 characters and kept secret.
3. Run **`npx prisma migrate deploy`** (not `migrate dev`) to apply migrations without prompts.
4. Build the frontend: `npm run build && npm start`.
5. Serve the backend behind a reverse proxy (nginx/caddy) with TLS.
6. For file uploads, configure a persistent volume or object storage (S3/R2) and update `UPLOAD_DIR` or the storage adapter.

## Project Structure

```
.
├── backend/
│   ├── prisma/          # schema, migrations, seed
│   └── src/
│       ├── controllers/ # request handlers
│       ├── middleware/  # auth, error handling
│       ├── routes/      # Express routers
│       └── index.ts     # app entry point
└── frontend/
    ├── app/             # Next.js App Router pages
    ├── components/      # shared UI components
    ├── lib/             # API client helpers
    ├── store/           # Zustand stores
    └── types/           # shared TypeScript types
```
