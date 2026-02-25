/*
  # Create role_permissions table

  This migration creates a system for granular permission control per user role.

  ## New Tables
  - `role_permissions`
    - `id` (uuid, primary key)
    - `role` (text) - one of: manager, receptionist, user
    - `permission` (text) - permission key (e.g. 'view_dashboard', 'manage_reservations')
    - `enabled` (boolean) - whether this permission is granted for the role
    - `created_at`, `updated_at`

  ## Permissions defined
  - dashboard: view_dashboard
  - calendar: view_calendar
  - terrains: view_terrains, manage_terrains
  - clients: view_clients, manage_clients, delete_clients
  - reservations: view_reservations, manage_reservations, cancel_reservations
  - rapports: view_rapports
  - payments: view_payments, manage_payments
  - backup: view_backup

  ## Security
  - RLS enabled
  - Only admins can read/write
  - Default permissions seeded for each non-admin role
*/

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('manager', 'receptionist', 'user')),
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
  );

CREATE POLICY "Admins can insert role_permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
  );

CREATE POLICY "Admins can update role_permissions"
  ON role_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
  );

CREATE POLICY "Admins can delete role_permissions"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true)
  );

CREATE POLICY "Authenticated users can read own role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions(role);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx ON role_permissions(permission);

-- Seed default permissions for manager role
INSERT INTO role_permissions (role, permission, enabled) VALUES
  ('manager', 'view_dashboard', true),
  ('manager', 'view_calendar', true),
  ('manager', 'view_terrains', true),
  ('manager', 'manage_terrains', true),
  ('manager', 'view_clients', true),
  ('manager', 'manage_clients', true),
  ('manager', 'delete_clients', true),
  ('manager', 'view_reservations', true),
  ('manager', 'manage_reservations', true),
  ('manager', 'cancel_reservations', true),
  ('manager', 'view_rapports', true),
  ('manager', 'view_payments', true),
  ('manager', 'manage_payments', true),
  ('manager', 'view_backup', false)
ON CONFLICT (role, permission) DO NOTHING;

-- Seed default permissions for receptionist role
INSERT INTO role_permissions (role, permission, enabled) VALUES
  ('receptionist', 'view_dashboard', true),
  ('receptionist', 'view_calendar', true),
  ('receptionist', 'view_terrains', true),
  ('receptionist', 'manage_terrains', false),
  ('receptionist', 'view_clients', true),
  ('receptionist', 'manage_clients', true),
  ('receptionist', 'delete_clients', false),
  ('receptionist', 'view_reservations', true),
  ('receptionist', 'manage_reservations', true),
  ('receptionist', 'cancel_reservations', false),
  ('receptionist', 'view_rapports', false),
  ('receptionist', 'view_payments', true),
  ('receptionist', 'manage_payments', true),
  ('receptionist', 'view_backup', false)
ON CONFLICT (role, permission) DO NOTHING;

-- Seed default permissions for user role
INSERT INTO role_permissions (role, permission, enabled) VALUES
  ('user', 'view_dashboard', true),
  ('user', 'view_calendar', true),
  ('user', 'view_terrains', true),
  ('user', 'manage_terrains', false),
  ('user', 'view_clients', true),
  ('user', 'manage_clients', false),
  ('user', 'delete_clients', false),
  ('user', 'view_reservations', true),
  ('user', 'manage_reservations', false),
  ('user', 'cancel_reservations', false),
  ('user', 'view_rapports', false),
  ('user', 'view_payments', false),
  ('user', 'manage_payments', false),
  ('user', 'view_backup', false)
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_role_permissions_updated_at();
