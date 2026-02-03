# Super In Tech - Project Management System

AI-powered Project Management System for Super In Tech (15-25 team members).

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: React Query + Zustand
- **Authentication**: JWT (Access + Refresh tokens)

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 10.0.0

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Make sure PostgreSQL is running, then create the database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE sit_pms;

# Exit psql
\q
```

### 3. Configure Environment

The `.env` files are already created. Update them if your PostgreSQL credentials are different:

- `apps/api/.env` - API configuration
- `apps/web/.env.local` - Frontend configuration

### 4. Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev --name init
```

### 5. Seed the Database

```bash
cd apps/api
npm run db:seed
```

### 6. Start Development Servers

From the root directory:

```bash
npm run dev
```

Or start individually:

```bash
# Terminal 1 - API
cd apps/api && npm run dev

# Terminal 2 - Web
cd apps/web && npm run dev
```

## Access the Application

- **Web App**: http://localhost:3006
- **API Server**: http://localhost:4000
- **API Health**: http://localhost:4000/api/health

## Login Credentials

After seeding the database:

| Role | Email | Password |
|------|-------|----------|
| Admin (CEO) | admin@superintech.com | admin123 |
| Manager | manager@superintech.com | admin123 |
| Employee | dev1@superintech.com | admin123 |

## Project Structure

```
super-in-tech-pms/
├── apps/
│   ├── api/                 # Express.js backend
│   │   ├── prisma/          # Database schema & migrations
│   │   └── src/
│   │       ├── controllers/ # Route handlers
│   │       ├── middleware/  # Auth & RBAC middleware
│   │       ├── routes/      # API routes
│   │       └── lib/         # Utilities (Prisma, JWT)
│   ├── web/                 # Next.js frontend
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities & API client
│   └── desktop/            # Electron app (Phase 8)
├── packages/
│   └── shared/             # Shared TypeScript types
├── turbo.json              # Turborepo configuration
└── package.json            # Root package.json
```

## Features (Phase 1 - Complete)

- [x] Monorepo setup with Turborepo
- [x] PostgreSQL database with Prisma ORM
- [x] Complete database schema (14 models)
- [x] JWT authentication (access + refresh tokens)
- [x] Role-based access control (6 roles)
- [x] User management API
- [x] Project management API
- [x] Task management API with time tracking
- [x] Next.js frontend with Tailwind CSS
- [x] Login page with authentication
- [x] Dashboard with statistics
- [x] Projects page (CRUD)
- [x] Tasks page (Kanban + List views)

## Upcoming Features

- **Phase 2**: Task Management enhancements (comments, file attachments)
- **Phase 3**: File Management (chunked upload, previews)
- **Phase 4**: Chat System (Socket.io, real-time messaging)
- **Phase 5**: KPI & EODR (Employee daily reports)
- **Phase 6**: AI Integration (OpenAI for task suggestions)
- **Phase 7**: Email Notifications
- **Phase 8**: Desktop App (Electron)

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user (Manager+)
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/members` - Add member
- `DELETE /api/projects/:id/members/:userId` - Remove member

### Tasks
- `GET /api/tasks` - List tasks
- `GET /api/tasks/:id` - Get task
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/reorder` - Reorder tasks
- `POST /api/tasks/:id/comments` - Add comment
- `POST /api/tasks/:id/timer/start` - Start timer
- `POST /api/tasks/:id/timer/:timeEntryId/stop` - Stop timer
- `GET /api/tasks/timer/active` - Get active timer

### Departments
- `GET /api/departments` - List departments
- `GET /api/departments/:id` - Get department
- `POST /api/departments` - Create department (Admin only)
- `PATCH /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department

## Useful Commands

```bash
# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Development
npm run dev             # Start all apps
npm run build           # Build all apps
npm run lint            # Lint all apps
```

## License

Private - Super In Tech
