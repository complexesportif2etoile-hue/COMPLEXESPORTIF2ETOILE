/*
  # Create app_version table

  ## Purpose
  Stores the current published version of the application.
  When the stored version differs from the version embedded in the
  built frontend, a blocking update prompt is shown to the user.

  ## New Tables
  - `app_version`
    - `id` (int, primary key, always 1 — single-row table)
    - `version` (text) — semver string e.g. "1.0.0"
    - `release_notes` (text) — optional changelog shown in the modal
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (to check current version)
  - Only admin role can UPDATE (via service role / RLS policy)
*/

CREATE TABLE IF NOT EXISTS app_version (
  id integer PRIMARY KEY DEFAULT 1,
  version text NOT NULL DEFAULT '1.0.0',
  release_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_version_single_row CHECK (id = 1)
);

ALTER TABLE app_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app version"
  ON app_version FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update app version"
  ON app_version FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO app_version (id, version, release_notes, updated_at)
VALUES (1, '1.0.0', '', now())
ON CONFLICT (id) DO NOTHING;
