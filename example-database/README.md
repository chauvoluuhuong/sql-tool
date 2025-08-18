## Example Database

This folder contains a single `init.sql` used by Docker's Postgres entrypoint to bootstrap a realistic demo database. It creates schemas, tables, constraints, triggers, views, a materialized view, indexes, partitions, and rich seed data.

### How it is loaded

- The `docker-compose.yml` mounts `example-database/` into `/docker-entrypoint-initdb.d` inside the Postgres container.
- On the first run (with a fresh volume), Postgres executes `init.sql` automatically.
- To re-run from scratch: bring the stack down with volumes, then up again.
  - `docker compose down -v`
  - `docker compose up -d`

### Schemas

- **app**: application data
- **audit**: immutable change logs written by triggers

### Entities and relationships (app schema)

- **organizations** `(id uuid PK, name unique, created_at, updated_at)`
  - One organization has many projects and many memberships.

- **users** `(id uuid PK, email unique citext, display_name, preferences jsonb, created_at, updated_at)`
  - Users can belong to many organizations via memberships.
  - Users can be assigned tasks (optional).

- **memberships** `(organization_id FK → organizations.id, user_id FK → users.id, role, joined_at, PK(organization_id, user_id))`
  - Many-to-many linking users and organizations with a role: `owner | admin | member | viewer`.
  - `ON DELETE CASCADE` from both sides to keep data consistent.

- **projects** `(id uuid PK, organization_id FK, name, status, tags[], created_at, updated_at)`
  - Belongs to an organization. Status: `active | archived`.
  - One project has many tasks.

- **tasks** `(id uuid PK, project_id FK, title, description, assigned_user_id FK nullable, priority 1..5, due_date, metadata jsonb, created_at, updated_at)`
  - Belongs to a project. Optionally assigned to a user.
  - Stores flexible data in `metadata` (JSONB), validated to be an object.

- **events** `(id bigserial, organization_id FK, occurred_at timestamptz, event_type, actor_user_id FK nullable, payload jsonb)`
  - Partitioned by range on `occurred_at`.
  - Primary key is composite `(id, occurred_at)` to satisfy partitioned-table constraints.
  - Default partition plus a current-month partition are created.

### Audit schema

- **audit.logs** `(id bigserial PK, table_name, operation, changed_at, actor uuid nullable, row_id, old_data jsonb, new_data jsonb)`
  - Receives immutable rows via row-level triggers on `app` tables (`INSERT | UPDATE | DELETE`).

### Triggers & functions

- `app.set_updated_at()`
  - BEFORE UPDATE on `organizations, users, projects, tasks` to maintain `updated_at`.
- `audit.log_write()`
  - AFTER `INSERT | UPDATE | DELETE` on `organizations, users, memberships, projects, tasks, events` to populate `audit.logs`.

### Views and materialized views

- `app.v_task_details`
  - Joins tasks → projects → organizations and assigned user to provide a denormalized view for UI/reporting.
- `app.v_user_organizations`
  - Lists each user’s organizations and roles via `memberships`.
- `app.mv_project_task_counts`
  - Materialized view with per-project task counts. Unique index on `project_id` for efficient refresh and lookups.
  - The init script refreshes this view after seeding.

### Indexes (selected)

- `projects(organization_id)`; partial index on active projects
- `tasks(project_id)`, `tasks(assigned_user_id)`, `GIN(tasks.metadata)`
- `events(organization_id)`, `events(event_type)`

### Seed data

The script inserts both curated and synthetic demo data:

- Named entities: `Acme Corp`, `Globex Inc`, plus `Initech LLC` and `Umbrella Corp`.
- Users: named users (`alice@`, `bob@`, `carol@`, etc.) and 100 synthetic users (`user1@…user100@`).
- Memberships: users assigned to organizations with roles.
- Projects: several per organization, covering different statuses and tags.
- Tasks: realistic tasks with priorities, due dates, and structured JSONB metadata.
- Events: historical activity, including 12 months of synthetic events for demo analytics.

### Example queries

```sql
-- Denormalized task list
SELECT * FROM app.v_task_details ORDER BY due_date NULLS LAST LIMIT 20;

-- Users and their org roles
SELECT * FROM app.v_user_organizations WHERE email ILIKE '%@example.com';

-- Project task counts
SELECT * FROM app.mv_project_task_counts ORDER BY task_count DESC LIMIT 10;

-- Recent audit entries
SELECT * FROM audit.logs ORDER BY changed_at DESC LIMIT 20;

-- Filter tasks by JSONB metadata
SELECT id, title, metadata->>'estimate' AS estimate
FROM app.tasks
WHERE metadata @> '{"labels":["design"]}';
```

### Partitioning notes

- `app.events` is partitioned by month. The script creates a default partition and a partition for the current month. Add more rolling partitions as needed.

### Credentials and connection

- Username: `postgres`
- Password: `postgres`
- Database: `postgres`
- Host: `localhost:5432`

### Recreate from scratch

If you want the init script to run again with a clean database:

- `docker compose down -v`
- `docker compose up -d`
