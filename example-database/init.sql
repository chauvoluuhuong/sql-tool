-- Example Database Initialization (single file)
-- This script sets up schemas, tables, partitions, functions, triggers,
-- views, materialized views, indexes, and inserts example records.

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS btree_gin; -- improve GIN sort/merge for some queries

-- 2) Schemas
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS audit;

-- 3) Tables
SET search_path = app, public;

CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE TABLE app.memberships (
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE app.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assigned_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  priority int NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  due_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata) = 'object')
);

-- Partitioned events table
CREATE TABLE app.events (
  id bigserial NOT NULL,
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (jsonb_typeof(payload) = 'object')
) PARTITION BY RANGE (occurred_at);

ALTER TABLE app.events
  ADD CONSTRAINT events_pk PRIMARY KEY (id, occurred_at);

-- Audit logs table
SET search_path = audit, public;
CREATE TABLE audit.logs (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  row_id text,
  old_data jsonb,
  new_data jsonb
);

-- 4) Functions
SET search_path = app, public;
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

SET search_path = audit, public;
CREATE OR REPLACE FUNCTION audit.log_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_id_text text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    row_id_text := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(NEW)->>'ID'));
    INSERT INTO audit.logs(table_name, operation, actor, row_id, old_data, new_data)
    VALUES (TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, TG_OP, NULL, row_id_text, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    row_id_text := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(NEW)->>'ID'));
    INSERT INTO audit.logs(table_name, operation, actor, row_id, old_data, new_data)
    VALUES (TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, TG_OP, NULL, row_id_text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    row_id_text := COALESCE((to_jsonb(OLD)->>'id'), (to_jsonb(OLD)->>'ID'));
    INSERT INTO audit.logs(table_name, operation, actor, row_id, old_data, new_data)
    VALUES (TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, TG_OP, NULL, row_id_text, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 5) Triggers
SET search_path = app, public;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON app.organizations
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON app.users
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON app.projects
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER tasks_set_updated_at
BEFORE UPDATE ON app.tasks
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

SET search_path = audit, public;
CREATE TRIGGER organizations_audit
AFTER INSERT OR UPDATE OR DELETE ON app.organizations
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

CREATE TRIGGER users_audit
AFTER INSERT OR UPDATE OR DELETE ON app.users
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

CREATE TRIGGER memberships_audit
AFTER INSERT OR UPDATE OR DELETE ON app.memberships
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

CREATE TRIGGER projects_audit
AFTER INSERT OR UPDATE OR DELETE ON app.projects
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

CREATE TRIGGER tasks_audit
AFTER INSERT OR UPDATE OR DELETE ON app.tasks
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

CREATE TRIGGER events_audit
AFTER INSERT OR UPDATE OR DELETE ON app.events
FOR EACH ROW EXECUTE FUNCTION audit.log_write();

-- 6) Partitions for events
SET search_path = app, public;
CREATE TABLE IF NOT EXISTS app.events_default PARTITION OF app.events DEFAULT;

DO $$
DECLARE
  start_month date := date_trunc('month', now())::date;
  end_month   date := (date_trunc('month', now()) + interval '1 month')::date;
  part_name   text := 'events_' || to_char(start_month, 'YYYY_MM');
  ddl text;
BEGIN
  ddl := format('CREATE TABLE IF NOT EXISTS app.%I PARTITION OF app.events FOR VALUES FROM (%L) TO (%L);',
                part_name, start_month::text, end_month::text);
  EXECUTE ddl;
END $$;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON app.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON app.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON app.tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_gin ON app.tasks USING GIN (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_projects_active_only ON app.projects(id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_events_org_id ON app.events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON app.events(event_type);

-- 8) Views
CREATE OR REPLACE VIEW app.v_task_details AS
SELECT 
  t.id AS task_id,
  t.title,
  t.priority,
  t.due_date,
  t.metadata,
  p.id AS project_id,
  p.name AS project_name,
  o.id AS organization_id,
  o.name AS organization_name,
  u.id AS assigned_user_id,
  u.display_name AS assigned_user_name
FROM app.tasks t
JOIN app.projects p ON p.id = t.project_id
JOIN app.organizations o ON o.id = p.organization_id
LEFT JOIN app.users u ON u.id = t.assigned_user_id;

CREATE OR REPLACE VIEW app.v_user_organizations AS
SELECT 
  u.id AS user_id,
  u.email,
  u.display_name,
  m.role,
  o.id AS organization_id,
  o.name AS organization_name
FROM app.users u
JOIN app.memberships m ON m.user_id = u.id
JOIN app.organizations o ON o.id = m.organization_id;

-- 9) Materialized Views
CREATE MATERIALIZED VIEW IF NOT EXISTS app.mv_project_task_counts AS
SELECT p.id AS project_id, p.name AS project_name, count(t.id) AS task_count
FROM app.projects p
LEFT JOIN app.tasks t ON t.project_id = p.id
GROUP BY p.id, p.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_project_task_counts_project_id_idx
  ON app.mv_project_task_counts(project_id);

-- Users
INSERT INTO app.users (email, display_name, preferences) VALUES
  ('alice@example.com', 'Alice', '{"theme":"dark","lang":"en"}'),
  ('bob@example.com',   'Bob',   '{"theme":"light","lang":"en"}'),
  ('carol@example.com', 'Carol', '{"theme":"dark","lang":"fr"}')
ON CONFLICT (email) DO NOTHING;

-- Organizations
INSERT INTO app.organizations (name) VALUES ('Acme Corp'), ('Globex Inc')
ON CONFLICT (name) DO NOTHING;

-- Memberships (Acme Corp)
INSERT INTO app.memberships (organization_id, user_id, role)
SELECT o.id, u.id, CASE WHEN u.email='alice@example.com' THEN 'owner' ELSE 'member' END
FROM app.users u
JOIN app.organizations o ON o.name = 'Acme Corp'
WHERE u.email IN ('alice@example.com','bob@example.com','carol@example.com')
ON CONFLICT DO NOTHING;

-- Projects using join to ensure valid organization_id
INSERT INTO app.projects (organization_id, name, status, tags)
SELECT o.id, v.project_name, v.status, v.tags
FROM (
  VALUES
    ('Acme Corp',  'Roadrunner Capture', 'active',   ARRAY['priority','ops']::text[]),
    ('Acme Corp',  'Anvils R&D',         'active',   ARRAY['r&d','hardware']::text[]),
    ('Globex Inc', 'Moon Base',          'archived', ARRAY['secret']::text[])
) AS v(org_name, project_name, status, tags)
JOIN app.organizations o ON o.name = v.org_name
ON CONFLICT DO NOTHING;

-- One initial task on 'Roadrunner Capture'
INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Design trap', 'Sketch the initial trap design',
       (SELECT id FROM app.users WHERE email='alice@example.com'), 2, current_date + 14,
       '{"estimate": 8, "labels": ["design"], "checklist": [{"text":"sketch","done":false}] }'
FROM app.projects p
JOIN app.organizations o ON o.id = p.organization_id
WHERE p.name = 'Roadrunner Capture' AND o.name = 'Acme Corp'
ON CONFLICT DO NOTHING;

-- Events for Acme
INSERT INTO app.events (organization_id, occurred_at, event_type, actor_user_id, payload)
SELECT o.id, now(), 'task.created', (SELECT id FROM app.users WHERE email='alice@example.com'),
       jsonb_build_object('task_ids', (SELECT jsonb_agg(t.id) FROM app.tasks t WHERE t.project_id = p.id))
FROM app.projects p
JOIN app.organizations o ON o.id = p.organization_id
WHERE p.name = 'Roadrunner Capture' AND o.name = 'Acme Corp'
UNION ALL
SELECT o.id, now() - interval '1 day', 'project.archived', (SELECT id FROM app.users WHERE email='bob@example.com'),
       jsonb_build_object('project', to_jsonb(p))
FROM app.projects p
JOIN app.organizations o ON o.id = p.organization_id
WHERE p.name = 'Anvils R&D' AND o.name = 'Acme Corp'
ON CONFLICT DO NOTHING;

-- Populate materialized view after initial seed
REFRESH MATERIALIZED VIEW app.mv_project_task_counts;

-- 12) Bulk synthetic demo data
-- 12.1) Add 100 synthetic users
INSERT INTO app.users (email, display_name, preferences)
SELECT 'user' || gs::text || '@example.com', 'User ' || gs::text,
       jsonb_build_object('theme', CASE WHEN gs % 2 = 0 THEN 'dark' ELSE 'light' END,
                          'lang', CASE WHEN gs % 3 = 0 THEN 'fr' ELSE 'en' END)
FROM generate_series(1, 100) AS gs
ON CONFLICT (email) DO NOTHING;

-- 12.2) Extra organization: Umbrella Corp
INSERT INTO app.organizations (name) VALUES ('Umbrella Corp')
ON CONFLICT (name) DO NOTHING;

-- 12.3) Add first 30 synthetic users to Umbrella Corp (user1 is owner)
INSERT INTO app.memberships (organization_id, user_id, role)
SELECT (SELECT id FROM app.organizations WHERE name='Umbrella Corp') AS org_id,
       u.id,
       CASE WHEN gs = 1 THEN 'owner' ELSE 'member' END AS role
FROM generate_series(1, 30) AS gs
JOIN app.users u ON u.email = 'user' || gs::text || '@example.com'
ON CONFLICT DO NOTHING;

-- 12.4) Projects for Umbrella
INSERT INTO app.projects (organization_id, name, status, tags) VALUES
  ((SELECT id FROM app.organizations WHERE name='Umbrella Corp'), 'T-Virus',      'active',  ARRAY['bio','r&d']),
  ((SELECT id FROM app.organizations WHERE name='Umbrella Corp'), 'Security',     'active',  ARRAY['ops','security']),
  ((SELECT id FROM app.organizations WHERE name='Umbrella Corp'), 'Containment',  'active',  ARRAY['infra','safety'])
ON CONFLICT DO NOTHING;

-- 12.5) 200 auto-generated tasks across Umbrella projects with random assignees
INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id,
       'Task #' || gs::text,
       'Auto-generated task ' || gs::text,
       (
         SELECT u.id
         FROM app.users u
         JOIN app.memberships m ON m.user_id = u.id
         WHERE m.organization_id = p.organization_id
         ORDER BY random() LIMIT 1
       ) AS assigned_user_id,
       ((random() * 4)::int + 1) AS priority,
       current_date + ((random() * 60)::int) AS due_date,
       jsonb_build_object(
         'estimate', ((random() * 13)::int + 1),
         'labels', ARRAY['auto','bulk']::text[],
         'batch', 1
       ) AS metadata
FROM generate_series(1, 200) AS gs
CROSS JOIN LATERAL (
  SELECT id, organization_id FROM app.projects 
  WHERE name IN ('T-Virus','Security','Containment')
  ORDER BY random() LIMIT 1
) AS p;

-- 12.6) Spread synthetic events across last 12 months
INSERT INTO app.events (organization_id, occurred_at, event_type, actor_user_id, payload)
SELECT 
  (SELECT id FROM app.organizations WHERE name='Umbrella Corp') AS org_id,
  (date_trunc('day', now()) - (m || ' months')::interval - (gs || ' days')::interval) AS occurred_at,
  'synthetic.event' AS event_type,
  (SELECT id FROM app.users WHERE email='user1@example.com') AS actor_user_id,
  jsonb_build_object('month_offset', m, 'seq', gs)
FROM generate_series(0, 11) AS m
CROSS JOIN generate_series(1, 60) AS gs;

-- Final refresh after bulk insert
REFRESH MATERIALIZED VIEW app.mv_project_task_counts;

-- 11) Additional seed data
-- Additional users
INSERT INTO app.users (email, display_name, preferences) VALUES
  ('dave@example.com',  'Dave',  '{"theme":"dark","lang":"en"}'),
  ('erin@example.com',  'Erin',  '{"theme":"light","lang":"en"}'),
  ('frank@example.com', 'Frank', '{"theme":"dark","lang":"de"}'),
  ('grace@example.com', 'Grace', '{"theme":"light","lang":"es"}')
ON CONFLICT (email) DO NOTHING;

-- Additional organization
INSERT INTO app.organizations (name) VALUES ('Initech LLC')
ON CONFLICT (name) DO NOTHING;

-- More memberships
INSERT INTO app.memberships (organization_id, user_id, role)
SELECT (SELECT id FROM app.organizations WHERE name='Globex Inc'), u.id, 'viewer'
FROM app.users u WHERE u.email IN ('carol@example.com','dave@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO app.memberships (organization_id, user_id, role)
SELECT (SELECT id FROM app.organizations WHERE name='Initech LLC'), u.id,
       CASE WHEN u.email='erin@example.com' THEN 'owner' ELSE 'member' END
FROM app.users u WHERE u.email IN ('erin@example.com','frank@example.com','grace@example.com')
ON CONFLICT DO NOTHING;

-- More projects
INSERT INTO app.projects (organization_id, name, status, tags) VALUES
  ((SELECT id FROM app.organizations WHERE name='Acme Corp'),   'Rocket Skates',     'active',   ARRAY['r&d','speed']),
  ((SELECT id FROM app.organizations WHERE name='Acme Corp'),   'Catapult Upgrade',  'active',   ARRAY['hardware','ops']),
  ((SELECT id FROM app.organizations WHERE name='Globex Inc'),  'Weather Control',   'active',   ARRAY['secret','r&d']),
  ((SELECT id FROM app.organizations WHERE name='Initech LLC'), 'TPS Reports',       'active',   ARRAY['paperwork','process'])
ON CONFLICT DO NOTHING;

-- More tasks across projects
INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Assemble skates', 'Put together rocket skates prototype',
       (SELECT id FROM app.users WHERE email='bob@example.com'), 3, current_date + 5,
       '{"estimate": 6, "labels": ["assembly"], "components": 12}'
FROM app.projects p 
WHERE p.name='Rocket Skates' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Acme Corp')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Fuel calibration', 'Calibrate rocket fuel mix for stability',
       (SELECT id FROM app.users WHERE email='carol@example.com'), 1, current_date + 3,
       '{"estimate": 10, "risk": "high", "labels": ["fuel","safety"]}'
FROM app.projects p 
WHERE p.name='Rocket Skates' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Acme Corp')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Sling tension test', 'Measure optimal sling tension',
       (SELECT id FROM app.users WHERE email='dave@example.com'), 2, current_date + 9,
       '{"estimate": 4, "labels": ["testing"], "tools": ["tension-meter"]}'
FROM app.projects p 
WHERE p.name='Catapult Upgrade' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Acme Corp')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Weather model v2', 'Improve prediction accuracy',
       (SELECT id FROM app.users WHERE email='erin@example.com'), 2, current_date + 21,
       '{"estimate": 13, "labels": ["ml","modeling"], "accuracyTarget": 0.92}'
FROM app.projects p 
WHERE p.name='Weather Control' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Globex Inc')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Retrofit sensors', 'Install atmospheric sensors across regions',
       (SELECT id FROM app.users WHERE email='frank@example.com'), 4, current_date + 30,
       '{"estimate": 21, "labels": ["deployment"], "regions": ["NA","EU","APAC"]}'
FROM app.projects p 
WHERE p.name='Weather Control' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Globex Inc')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Collect TPS samples', 'Gather recent TPS reports from teams',
       (SELECT id FROM app.users WHERE email='grace@example.com'), 5, current_date + 2,
       '{"estimate": 2, "labels": ["collection"], "countTarget": 25}'
FROM app.projects p 
WHERE p.name='TPS Reports' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Initech LLC')
ON CONFLICT DO NOTHING;

INSERT INTO app.tasks (project_id, title, description, assigned_user_id, priority, due_date, metadata)
SELECT p.id, 'Normalize templates', 'Unify report templates and fields',
       NULL, 3, current_date + 10,
       '{"estimate": 8, "labels": ["templates","standardization"], "owner": null}'
FROM app.projects p 
WHERE p.name='TPS Reports' AND p.organization_id=(SELECT id FROM app.organizations WHERE name='Initech LLC')
ON CONFLICT DO NOTHING;

-- More events across different times
INSERT INTO app.events (organization_id, occurred_at, event_type, actor_user_id, payload)
SELECT (SELECT id FROM app.organizations WHERE name='Acme Corp'), now() - interval '12 hours', 'task.updated',
       (SELECT id FROM app.users WHERE email='alice@example.com'),
       jsonb_build_object('field','priority','old',3,'new',1)
UNION ALL
SELECT (SELECT id FROM app.organizations WHERE name='Acme Corp'), now() - interval '35 days', 'task.completed',
       (SELECT id FROM app.users WHERE email='bob@example.com'),
       jsonb_build_object('task','Design trap')
UNION ALL
SELECT (SELECT id FROM app.organizations WHERE name='Globex Inc'), now() - interval '3 days', 'membership.added',
       (SELECT id FROM app.users WHERE email='erin@example.com'),
       jsonb_build_object('user','carol@example.com','role','viewer')
UNION ALL
SELECT (SELECT id FROM app.organizations WHERE name='Initech LLC'), now() - interval '6 hours', 'task.created',
       (SELECT id FROM app.users WHERE email='grace@example.com'),
       jsonb_build_object('title','Normalize templates')
ON CONFLICT DO NOTHING;

-- Final refresh of materialized view to capture additional tasks
REFRESH MATERIALIZED VIEW app.mv_project_task_counts;

