---
name: db-migration
description: Generate or apply Drizzle ORM database migrations for Jake
disable-model-invocation: true
---

# Database Migration

Manage Drizzle ORM migrations for the Jake app.

## Local Development

### Generate a new migration

After modifying Drizzle table definitions in `apps/api/src/@logic/*/infrastructure/table/`:

```bash
pnpm --filter @jake/api db:generate
```

This creates a new SQL file in `apps/api/drizzle/`. Review the generated SQL before applying.

### Apply migrations locally

```bash
pnpm db:migrate
```

This runs `drizzle-kit migrate` which applies pending migrations to the local PostgreSQL.

### Seed data (if needed)

```bash
pnpm db:seed
```

## Production

**Important**: `drizzle-kit` is a devDependency and is NOT available in the production Docker image.

### Apply migrations in production

SSH into the server or run via docker compose:

```bash
ssh -i ~/.ssh/jake-deploy root@192.248.177.48
cd /root/jake
docker compose -f docker-compose.prod.yml run --rm api node dist/migrate.js
```

### Manual SQL (emergency)

If you need to run raw SQL on production:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U jake -d jake
```

## Workflow Checklist

1. Modify table definitions in `infrastructure/table/` files
2. Run `pnpm --filter @jake/api db:generate` to generate migration
3. Review the generated SQL in `apps/api/drizzle/`
4. Run `pnpm db:migrate` to apply locally
5. Test that the app works with the new schema
6. Commit the migration file along with the table changes
7. After deploy, run migration on production via `node dist/migrate.js`

## Common Gotchas

- **pgvector**: If using vector columns, ensure `CREATE EXTENSION IF NOT EXISTS vector` is in your migration
- **UUID PKs**: All tables use UUID primary keys — use `uuid('id').defaultRandom().primaryKey()`
- **Enums**: Drizzle generates `CREATE TYPE` statements — these can't be easily rolled back, plan carefully
