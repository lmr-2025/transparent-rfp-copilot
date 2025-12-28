# Database Setup Guide

This guide explains how to set up the PostgreSQL database for GRC Minion.

## Overview

GRC Minion uses PostgreSQL as its database with Prisma as the ORM. For local development, we use Docker to run PostgreSQL. For production, we'll deploy to AWS RDS.

## Prerequisites

### Install Docker Desktop

Docker Desktop is required to run the PostgreSQL database locally.

**macOS:**
```bash
# Using Homebrew
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

**Windows:**
- Download from: https://www.docker.com/products/docker-desktop
- Follow the installation wizard

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

After installation, verify Docker is running:
```bash
docker --version
docker compose version
```

## Local Development Setup

### 1. Configure Environment Variables

The `.env` file has already been created with the default database connection string:

```env
DATABASE_URL="postgresql://grcminion:grcminion_dev_password@localhost:5432/grcminion"
ANTHROPIC_API_KEY=your_api_key_here
```

**Note:** This project uses Prisma 7, which stores database configuration in `prisma.config.ts` instead of the schema file. The `DATABASE_URL` is read from the `.env` file automatically.

If you need to change database credentials, update both `.env` and `docker-compose.yml` to match.

### 2. Start PostgreSQL Database

Start the PostgreSQL container using Docker Compose:

```bash
# From the app directory
docker compose up -d
```

This will:
- Download the PostgreSQL 16 Alpine image (first time only)
- Create a container named `grc-minion-db`
- Start PostgreSQL on port 5432
- Create a database named `grcminion`
- Set up the user `grcminion` with password `grcminion_dev_password`

Verify the database is running:
```bash
docker compose ps
```

You should see:
```
NAME              IMAGE                 STATUS
grc-minion-db     postgres:16-alpine    Up
```

### 3. Run Database Migrations

Generate the Prisma Client and create the database schema:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev --name init
```

This will:
- Create the `BulkProject` and `BulkRow` tables
- Set up indexes for performance
- Generate TypeScript types for database access

### 4. Verify Database Setup

Check that the database is set up correctly:

```bash
# Open Prisma Studio to view the database
npx prisma studio
```

This will open a web interface at http://localhost:5555 where you can:
- View all tables
- Browse existing data
- Test queries

## Testing the Setup

### Test the API Routes

Start the development server:
```bash
npm run dev
```

Test the API endpoints:

1. **Create a project** (using Postman, curl, or the UI):
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "sheetName": "Sheet1",
    "columns": ["Question", "Response"],
    "rows": [
      {
        "rowNumber": 1,
        "question": "Test question?",
        "response": "",
        "status": "pending"
      }
    ]
  }'
```

2. **Get all projects**:
```bash
curl http://localhost:3000/api/projects
```

3. **Test in the UI**:
   - Go to http://localhost:3000/projects/upload
   - Upload a CSV file
   - Verify it appears in http://localhost:3000/projects

## Common Commands

### Database Management

```bash
# Stop the database
docker compose stop

# Start the database
docker compose start

# Restart the database
docker compose restart

# View logs
docker compose logs -f postgres

# Stop and remove the database (WARNING: deletes all data)
docker compose down

# Stop and remove including volumes (WARNING: permanent data loss)
docker compose down -v
```

### Prisma Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Format schema file
npx prisma format
```

## Troubleshooting

### Port 5432 Already in Use

If you get an error that port 5432 is already in use:

1. Check if PostgreSQL is already running:
```bash
# macOS/Linux
lsof -i :5432

# Stop existing PostgreSQL
sudo pkill postgres
```

2. Or change the port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Use port 5433 instead
```

Then update `.env`:
```env
DATABASE_URL="postgresql://grcminion:grcminion_dev_password@localhost:5433/grcminion"
```

### Connection Refused

If you get "connection refused" errors:

1. Verify Docker is running:
```bash
docker ps
```

2. Check the container logs:
```bash
docker compose logs postgres
```

3. Wait for the database to finish starting (check health status):
```bash
docker compose ps
```

### Migration Errors

If migrations fail:

1. Check your DATABASE_URL in `.env` is correct
2. Verify the database is running: `docker compose ps`
3. Try resetting and re-running:
```bash
npx prisma migrate reset
npx prisma migrate dev
```

## Production Deployment (AWS)

### Prerequisites
- AWS account with RDS access
- AWS CLI configured
- Terraform or AWS CDK (optional, for infrastructure as code)

### Steps

1. **Create RDS PostgreSQL Instance**:
   - Instance size: db.t3.micro (can scale up)
   - PostgreSQL 16
   - Enable automatic backups
   - Set up security groups to allow access from your app

2. **Update Environment Variables**:
```env
# Production .env
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/grcminion"
ANTHROPIC_API_KEY=your_production_api_key
```

3. **Run Migrations**:
```bash
npx prisma migrate deploy
```

4. **Deploy Application** (AWS Amplify):
   - Connect your GitHub repository
   - Set environment variables in Amplify console
   - Deploy

## Architecture

### Database Schema

**BulkProject** (Main project table):
- `id` (UUID, primary key)
- `name` (string)
- `sheetName` (string)
- `columns` (string array)
- `createdAt` (timestamp)
- `lastModifiedAt` (timestamp)
- `ownerName` (string, optional)
- `customerName` (string, optional)
- `status` (enum: DRAFT, IN_PROGRESS, NEEDS_REVIEW, APPROVED)
- `notes` (text, optional)

**BulkRow** (Question/answer rows):
- `id` (UUID, primary key)
- `projectId` (UUID, foreign key to BulkProject)
- `rowNumber` (integer)
- `question` (text)
- `response` (text)
- `status` (enum: PENDING, COMPLETED, ERROR)
- `error` (text, optional)
- `conversationHistory` (JSON, optional)
- `confidence` (string, optional)
- `sources` (text, optional)
- `remarks` (text, optional)
- `usedSkills` (JSON, optional)
- `showRecommendation` (boolean)

### Indexes
- `BulkProject.status` - For filtering by status
- `BulkProject.lastModifiedAt` - For sorting by modification time
- `BulkRow.projectId` - For efficient project row lookups
- `BulkRow.status` - For filtering rows by status

---

## Database Hardening

The database schema includes several hardening measures to ensure data integrity:

### Unique Constraints
- `Skill.title` - Prevents duplicate skill titles (case-insensitive)
- `CustomerProfile.name` - Prevents duplicate customer names (case-insensitive)

### GIN Indexes on Array Fields
For efficient filtering on array columns:
- `Skill.categories`
- `KnowledgeDocument.categories`
- `ReferenceUrl.categories`
- `KnowledgeRequest.categories`
- `InstructionPreset.defaultCategories`

### Preflight Checks

Before applying migrations, run the preflight script to detect issues:

```bash
npm run db:preflight
```

The preflight script fails (exit code 1) if it detects:
- Duplicate skill titles (case-insensitive)
- Duplicate customer names (case-insensitive)
- Null `ownerId` on: Skill, CustomerProfile, KnowledgeDocument, BulkProject, Template, CollateralOutput, ContractReview

### Migration Best Practices

**For fresh database setup:**
```bash
# 1. Drop and recreate schema (dev-safe only)
psql "$DATABASE_URL" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

# 2. Apply baseline migration
psql "$DATABASE_URL" -f prisma/migrations/20251228010000_baseline/migration.sql

# 3. Regenerate Prisma client
npx prisma generate

# 4. Run preflight check
npm run db:preflight
```

**Before deploying migrations:**
1. Resolve any duplicates reported by preflight (rename/merge as appropriate)
2. Backfill missing owners (assign real owner or "system" owner)
3. Re-run `npm run db:preflight` until clean
4. Apply migrations with `npx prisma migrate deploy`

**Important Notes:**
- The baseline migration (`20251228010000_baseline`) is the source of truth
- Legacy migrations were removed to avoid drift
- For production RDS, never drop the schema - use migrations instead

---

## Docker Compose Database Configuration

The Docker Compose setup uses specific configurations to avoid conflicts:

### Port Mapping
- Container uses standard PostgreSQL port: `5432`
- Host binds to port: `55432` (to avoid conflicts with system PostgreSQL)
- Connection string for Docker database: `postgresql://grcminion:grcminion_dev_password@127.0.0.1:55432/grcminion?schema=public`

### Environment Variables

To avoid repeating the DATABASE_URL, add it to `.env.local`:
```bash
DATABASE_URL=postgresql://grcminion:grcminion_dev_password@127.0.0.1:55432/grcminion?schema=public
```

Then source it before running commands:
```bash
source .env.local
```

Or add it to your shell profile (`~/.zshrc` or `~/.bashrc`) to load automatically.

### Data Persistence
- Docker volume: `postgres_data`
- Data persists across container restarts
- To reset: `docker-compose down -v` (removes volume)

---

## Next Steps

Once the database is set up and running:
1. Test the full workflow: upload → generate responses → review
2. Verify auto-save is working (check Prisma Studio)
3. Test multi-user scenarios if needed
4. Plan AWS deployment timeline
