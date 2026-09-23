-- WaveGuard schema. Running this file wipes all WaveGuard data.
DROP TABLE IF EXISTS events, reports, blocklist, campaigns, directory, known_domains CASCADE;

-- Official campus people and offices (fictional seed data only).
CREATE TABLE directory (
  id              serial PRIMARY KEY,
  name            text   NOT NULL,
  title           text,
  department      text,
  official_emails text[] NOT NULL,
  verify_channel  text
);

-- Domains the campus actually uses. Never auto-blocked.
CREATE TABLE known_domains (
  domain  text PRIMARY KEY,
  owner   text NOT NULL,
  purpose text NOT NULL
);

CREATE TABLE campaigns (
  id           serial PRIMARY KEY,
  label        text        NOT NULL,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now(),
  report_count integer     NOT NULL DEFAULT 0
);

CREATE TABLE reports (
  id                  serial PRIMARY KEY,
  reporter_id         text        NOT NULL,
  url                 text,
  domain              text,
  url_hash            char(64),
  domain_hash         char(64),
  sender_email        text,
  sender_display_name text,
  excerpt             varchar(500),
  reason              text,
  campaign_id         integer REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR sender_email IS NOT NULL)
);
CREATE INDEX reports_url_hash_idx    ON reports (url_hash);
CREATE INDEX reports_domain_hash_idx ON reports (domain_hash);
CREATE INDEX reports_sender_idx      ON reports (lower(sender_email));

-- One row per reported URL, registrable domain, or sender address.
-- label/domain are plaintext copies of data already in reports, for the dashboard.
CREATE TABLE blocklist (
  id           serial PRIMARY KEY,
  hash         char(64)    NOT NULL UNIQUE,
  kind         text        NOT NULL CHECK (kind IN ('url', 'domain', 'sender')),
  status       text        NOT NULL CHECK (status IN ('warn', 'block', 'dismissed')),
  label        text        NOT NULL,
  domain       text,
  report_count integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blocklist_prefix_idx ON blocklist (substr(hash, 1, 8));
CREATE INDEX blocklist_domain_idx ON blocklist (domain);

-- Hash-only log for the "users protected" counter. No URLs, no user ids.
CREATE TABLE events (
  id         serial PRIMARY KEY,
  type       text        NOT NULL CHECK (type IN ('warned', 'continued')),
  hash       char(64),
  created_at timestamptz NOT NULL DEFAULT now()
);
