-- =============================================================
-- SCRIPT DE MIGRATION COMPLET - BASE DE DONNÉES PRODUCTION
-- À exécuter dans le SQL Editor du nouveau projet Supabase PROD
-- =============================================================


-- =====================
-- 1. FONCTIONS UTILITAIRES
-- =====================

CREATE OR REPLACE FUNCTION public.generate_reservation_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM reservations WHERE code_court = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_user_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  ) INTO is_user_admin;
  RETURN COALESCE(is_user_admin, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_first_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  RETURN (user_count = 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(p_user_id uuid, p_email text, p_full_name text, p_is_first boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    p_user_id,
    p_email,
    p_full_name,
    CASE WHEN p_is_first THEN 'admin' ELSE 'user' END,
    true
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(p_user_id uuid, p_email text, p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (p_user_id, p_email, p_full_name, 'user', true)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_role_stats()
RETURNS TABLE(role_name text, user_count bigint, active_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.role, COUNT(*)::bigint, COUNT(*) FILTER (WHERE p.active = true)::bigint
  FROM profiles p
  GROUP BY p.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  ) THEN
    RETURN false;
  END IF;
  UPDATE profiles SET role = 'admin' WHERE id = target_user_id;
  RETURN true;
END;
$$;


-- =====================
-- 2. TABLES
-- =====================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role = ANY (ARRAY['admin','manager','user','receptionist'])),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terrains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  tarif_horaire numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id uuid NOT NULL REFERENCES terrains(id),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  date_debut timestamptz NOT NULL,
  date_fin timestamptz NOT NULL,
  tarif_total numeric NOT NULL DEFAULT 0,
  tva_applicable boolean DEFAULT false,
  montant_tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'réservé' CHECK (statut = ANY (ARRAY['en_attente','libre','réservé','check_in','check_out','terminé','annulé','bloqué'])),
  motif_blocage text DEFAULT '',
  motif_annulation text,
  notes text DEFAULT '',
  payment_status text NOT NULL DEFAULT 'UNPAID' CHECK (payment_status = ANY (ARRAY['UNPAID','PARTIAL','PAID'])),
  payment_method text NOT NULL DEFAULT 'ON_SITE' CHECK (payment_method = ANY (ARRAY['ON_SITE','WAVE','ORANGE_MONEY'])),
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  deposit_amount numeric NOT NULL DEFAULT 0,
  code_court text UNIQUE DEFAULT generate_reservation_code(),
  created_by uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encaissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  montant_total numeric NOT NULL,
  mode_paiement text NOT NULL CHECK (mode_paiement = ANY (ARRAY['especes','orange_money','wave','mixte','autre'])),
  details_paiement jsonb DEFAULT '{}',
  encaisse_par uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  numero_facture text UNIQUE NOT NULL,
  montant_ht numeric NOT NULL,
  montant_tva numeric DEFAULT 0,
  montant_ttc numeric NOT NULL,
  date_emission timestamptz DEFAULT now(),
  emise_par uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id),
  provider text NOT NULL CHECK (provider = ANY (ARRAY['WAVE','ORANGE_MONEY'])),
  reference text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status = ANY (ARRAY['PENDING','SUCCESS','FAILED','CANCELLED'])),
  amount numeric NOT NULL DEFAULT 0,
  phone text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT '',
  company_address text DEFAULT '',
  company_phone text DEFAULT '',
  company_email text DEFAULT '',
  company_website text DEFAULT '',
  tax_id text DEFAULT '',
  logo_url text DEFAULT '',
  currency text DEFAULT 'FCFA',
  tax_rate numeric DEFAULT 18,
  invoice_prefix text DEFAULT 'INV',
  invoice_footer text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text UNIQUE NOT NULL,
  valeur jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historique_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deposit_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deposit_type text NOT NULL DEFAULT 'PERCENTAGE' CHECK (deposit_type = ANY (ARRAY['PERCENTAGE','FIXED'])),
  deposit_value numeric NOT NULL DEFAULT 30,
  online_payment_enabled boolean NOT NULL DEFAULT false,
  wave_number text NOT NULL DEFAULT '',
  orange_money_number text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role = ANY (ARRAY['manager','receptionist','user'])),
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (role, permission)
);


-- =====================
-- 3. INDEX
-- =====================

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_encaissements_reservation_id ON encaissements(reservation_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_encaisse_par ON encaissements(encaisse_par);
CREATE INDEX IF NOT EXISTS idx_factures_reservation_id ON factures(reservation_id);
CREATE INDEX IF NOT EXISTS idx_factures_emise_par ON factures(emise_par);
CREATE INDEX IF NOT EXISTS idx_historique_actions_user_id ON historique_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_terrain_id ON reservations(terrain_id);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by ON reservations(created_by);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions(role);


-- =====================
-- 4. FONCTIONS TRIGGERS
-- =====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'user' END,
    true
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reservations
    WHERE terrain_id = NEW.terrain_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND statut NOT IN ('annulé', 'terminé')
    AND (
      (NEW.date_debut >= date_debut AND NEW.date_debut < date_fin)
      OR (NEW.date_fin > date_debut AND NEW.date_fin <= date_fin)
      OR (NEW.date_debut <= date_debut AND NEW.date_fin >= date_fin)
    )
  ) THEN
    RAISE EXCEPTION 'Une réservation existe déjà pour ce terrain durant cette période';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_checkin_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'check_in' AND OLD.statut != 'check_in' THEN
    IF NOW() < (NEW.date_debut - INTERVAL '10 minutes') THEN
      RAISE EXCEPTION 'Le check-in n''est possible qu''à partir de % (10 minutes avant)',
        TO_CHAR(NEW.date_debut - INTERVAL '10 minutes', 'DD/MM/YYYY à HH24:MI');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_reservation_not_in_past()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.date_debut < (NOW() - INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Impossible de créer une réservation pour une date passée';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_complete_reservation_on_full_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_paid numeric;
  reservation_total numeric;
BEGIN
  SELECT COALESCE(SUM(montant_total), 0) INTO total_paid
  FROM encaissements WHERE reservation_id = NEW.reservation_id;

  SELECT montant_ttc INTO reservation_total
  FROM reservations WHERE id = NEW.reservation_id;

  IF total_paid >= reservation_total THEN
    UPDATE reservations SET statut = 'check_in'
    WHERE id = NEW.reservation_id AND statut = 'réservé';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_backup(
  p_terrains jsonb DEFAULT '[]'::jsonb,
  p_clients jsonb DEFAULT '[]'::jsonb,
  p_reservations jsonb DEFAULT '[]'::jsonb,
  p_encaissements jsonb DEFAULT '[]'::jsonb,
  p_factures jsonb DEFAULT '[]'::jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_company_settings jsonb DEFAULT '[]'::jsonb,
  p_deposit_settings jsonb DEFAULT '[]'::jsonb,
  p_role_permissions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_errors text[] := ARRAY[]::text[];
  v_row jsonb;
  v_caller_role text;
  v_sanitized_reservations jsonb;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès refusé : rôle admin requis';
  END IF;

  DELETE FROM encaissements;
  DELETE FROM factures;
  DELETE FROM payments;
  DELETE FROM reservations;
  DELETE FROM clients;
  DELETE FROM terrains;
  DELETE FROM company_settings;

  IF jsonb_array_length(p_terrains) > 0 THEN
    BEGIN
      INSERT INTO terrains SELECT * FROM jsonb_populate_recordset(null::terrains, p_terrains);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'terrains: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_clients) > 0 THEN
    BEGIN
      INSERT INTO clients SELECT * FROM jsonb_populate_recordset(null::clients, p_clients);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'clients: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_reservations) > 0 THEN
    BEGIN
      SELECT jsonb_agg(
        r || jsonb_build_object(
          'created_by',
          CASE
            WHEN (r->>'created_by') IS NOT NULL
            AND EXISTS (SELECT 1 FROM profiles WHERE id = (r->>'created_by')::uuid)
            THEN r->'created_by'
            ELSE 'null'::jsonb
          END,
          'payment_method', COALESCE(r->>'payment_method', 'ON_SITE'),
          'payment_status', COALESCE(r->>'payment_status', 'UNPAID')
        )
      )
      INTO v_sanitized_reservations
      FROM jsonb_array_elements(p_reservations) AS r;

      INSERT INTO reservations SELECT * FROM jsonb_populate_recordset(null::reservations, v_sanitized_reservations);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'reservations: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_encaissements) > 0 THEN
    BEGIN
      INSERT INTO encaissements SELECT * FROM jsonb_populate_recordset(null::encaissements, p_encaissements);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'encaissements: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_factures) > 0 THEN
    BEGIN
      INSERT INTO factures SELECT * FROM jsonb_populate_recordset(null::factures, p_factures);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'factures: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_payments) > 0 THEN
    BEGIN
      INSERT INTO payments SELECT * FROM jsonb_populate_recordset(null::payments, p_payments);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'payments: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_company_settings) > 0 THEN
    BEGIN
      INSERT INTO company_settings SELECT * FROM jsonb_populate_recordset(null::company_settings, p_company_settings);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'company_settings: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_deposit_settings) > 0 THEN
    BEGIN
      FOR v_row IN SELECT * FROM jsonb_array_elements(p_deposit_settings) LOOP
        INSERT INTO deposit_settings SELECT * FROM jsonb_populate_record(null::deposit_settings, v_row)
        ON CONFLICT (id) DO UPDATE SET
          deposit_type = EXCLUDED.deposit_type,
          deposit_value = EXCLUDED.deposit_value,
          online_payment_enabled = EXCLUDED.online_payment_enabled,
          wave_number = EXCLUDED.wave_number,
          orange_money_number = EXCLUDED.orange_money_number,
          updated_at = EXCLUDED.updated_at;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'deposit_settings: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_role_permissions) > 0 THEN
    BEGIN
      FOR v_row IN SELECT * FROM jsonb_array_elements(p_role_permissions) LOOP
        INSERT INTO role_permissions SELECT * FROM jsonb_populate_record(null::role_permissions, v_row)
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          permission = EXCLUDED.permission,
          enabled = EXCLUDED.enabled,
          updated_at = EXCLUDED.updated_at;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'role_permissions: ' || SQLERRM);
    END;
  END IF;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', to_jsonb(v_errors));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =====================
-- 5. TRIGGERS
-- =====================

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER check_reservation_overlap_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION check_reservation_overlap();

CREATE TRIGGER prevent_past_reservations
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION validate_reservation_not_in_past();

CREATE TRIGGER validate_checkin_before_update
  BEFORE UPDATE OF statut ON reservations
  FOR EACH ROW WHEN ((new.statut = 'check_in') AND (old.statut <> 'check_in'))
  EXECUTE FUNCTION validate_checkin_time();

CREATE TRIGGER trigger_auto_complete_on_payment
  AFTER INSERT ON encaissements
  FOR EACH ROW EXECUTE FUNCTION auto_complete_reservation_on_full_payment();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_role_permissions_updated_at();


-- =====================
-- 6. ROW LEVEL SECURITY
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE terrains ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "authenticated_users_can_view_all_profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_and_admins_can_insert_profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    (( SELECT auth.uid()) = id) OR
    (( SELECT auth.uid()) IN (
      SELECT profiles_1.id FROM profiles profiles_1
      WHERE profiles_1.role = 'admin' AND profiles_1.active = true
    ))
  );

CREATE POLICY "users_and_admins_can_update_profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    (( SELECT auth.uid()) = id) OR
    (( SELECT auth.uid()) IN (
      SELECT profiles_1.id FROM profiles profiles_1
      WHERE profiles_1.role = 'admin' AND profiles_1.active = true
    ))
  )
  WITH CHECK (
    (( SELECT auth.uid()) = id) OR
    (( SELECT auth.uid()) IN (
      SELECT profiles_1.id FROM profiles profiles_1
      WHERE profiles_1.role = 'admin' AND profiles_1.active = true
    ))
  );

-- terrains
CREATE POLICY "Tous peuvent voir les terrains actifs"
  ON terrains FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can read active terrains"
  ON terrains FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Admins et managers peuvent créer des terrains"
  ON terrains FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
  ));

CREATE POLICY "Admins et managers peuvent modifier des terrains"
  ON terrains FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
  ));

CREATE POLICY "Seuls les admins peuvent supprimer des terrains"
  ON terrains FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = 'admin'
  ));

-- clients
CREATE POLICY "Authenticated users can view all clients"
  ON clients FOR SELECT TO authenticated
  USING (( SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (( SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Public can insert clients"
  ON clients FOR INSERT TO anon
  WITH CHECK (name <> '' AND phone <> '');

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE TO authenticated
  USING (( SELECT auth.uid()) IS NOT NULL)
  WITH CHECK (( SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Admin and manager can delete clients"
  ON clients FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
  ));

-- reservations
CREATE POLICY "Tous peuvent voir les réservations"
  ON reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can read reservation by code"
  ON reservations FOR SELECT TO anon
  USING (code_court IS NOT NULL);

CREATE POLICY "Authenticated users can create reservations"
  ON reservations FOR INSERT TO authenticated
  WITH CHECK (
    ((created_by IS NULL) OR (created_by = ( SELECT auth.uid())))
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = ( SELECT auth.uid()) AND p.active = true
    )
  );

CREATE POLICY "Public can insert reservations with en_attente status"
  ON reservations FOR INSERT TO anon
  WITH CHECK (
    statut = 'en_attente'
    AND created_by IS NULL
    AND payment_method = ANY (ARRAY['ON_SITE','WAVE','ORANGE_MONEY'])
    AND payment_status = ANY (ARRAY['UNPAID','PARTIAL','PAID'])
    AND amount_due >= 0
    AND amount_paid >= 0
    AND deposit_amount >= 0
  );

CREATE POLICY "Active users can update reservations"
  ON reservations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.active = true
  ));

CREATE POLICY "Admins peuvent supprimer des réservations"
  ON reservations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ));

-- encaissements
CREATE POLICY "Tous peuvent voir les encaissements"
  ON encaissements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Active users can create encaissements"
  ON encaissements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.active = true
  ));

-- factures
CREATE POLICY "Tous peuvent voir les factures"
  ON factures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Active users can create factures"
  ON factures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.active = true
  ));

-- payments
CREATE POLICY "Authenticated can read payments"
  ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can read own pending payment"
  ON payments FOR SELECT TO anon USING (status = 'PENDING');

CREATE POLICY "Public can insert payments"
  ON payments FOR INSERT TO anon
  WITH CHECK (
    provider = ANY (ARRAY['WAVE','ORANGE_MONEY'])
    AND amount > 0
    AND status = 'PENDING'
  );

CREATE POLICY "Authenticated can update payments"
  ON payments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
    AND profiles.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = ANY (ARRAY['admin','manager'])
    AND profiles.active = true
  ));

-- company_settings
CREATE POLICY "Authenticated users can view settings"
  ON company_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert settings"
  ON company_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can update settings"
  ON company_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can delete settings"
  ON company_settings FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ));

-- configuration
CREATE POLICY "Tous peuvent voir la configuration"
  ON configuration FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins peuvent modifier la configuration"
  ON configuration FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid()) AND profiles.role = 'admin'
  ));

-- historique_actions
CREATE POLICY "Tous peuvent voir l'historique"
  ON historique_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can log actions"
  ON historique_actions FOR INSERT TO authenticated
  WITH CHECK (user_id = ( SELECT auth.uid()));

-- deposit_settings
CREATE POLICY "Authenticated can read deposit settings"
  ON deposit_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can read deposit settings"
  ON deposit_settings FOR SELECT TO anon USING (true);

CREATE POLICY "Admins can insert deposit settings"
  ON deposit_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = 'admin' AND profiles.active = true
  ));

CREATE POLICY "Admins can update deposit settings"
  ON deposit_settings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = 'admin' AND profiles.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = ( SELECT auth.uid())
    AND profiles.role = 'admin' AND profiles.active = true
  ));

-- role_permissions
CREATE POLICY "Users can read own or admin can read all role_permissions"
  ON role_permissions FOR SELECT TO authenticated
  USING (
    (role = ( SELECT p.role FROM profiles p WHERE p.id = ( SELECT auth.uid()) LIMIT 1))
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = ( SELECT auth.uid()) AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert role_permissions"
  ON role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ( SELECT auth.uid()) AND p.role = 'admin'
  ));

CREATE POLICY "Admins can update role_permissions"
  ON role_permissions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ( SELECT auth.uid()) AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ( SELECT auth.uid()) AND p.role = 'admin'
  ));

CREATE POLICY "Admins can delete role_permissions"
  ON role_permissions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ( SELECT auth.uid()) AND p.role = 'admin'
  ));


-- =====================
-- 7. DONNÉES INITIALES (Permissions par défaut)
-- =====================

INSERT INTO deposit_settings (id, deposit_type, deposit_value, online_payment_enabled, wave_number, orange_money_number)
VALUES (1, 'PERCENTAGE', 30, false, '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role, permission, enabled) VALUES
  ('manager', 'cancel_reservations', true),
  ('manager', 'delete_clients', true),
  ('manager', 'manage_clients', true),
  ('manager', 'manage_payments', true),
  ('manager', 'manage_reservations', true),
  ('manager', 'manage_terrains', true),
  ('manager', 'view_backup', false),
  ('manager', 'view_calendar', true),
  ('manager', 'view_clients', true),
  ('manager', 'view_dashboard', true),
  ('manager', 'view_payments', true),
  ('manager', 'view_rapports', true),
  ('manager', 'view_reservations', true),
  ('manager', 'view_terrains', true),
  ('receptionist', 'cancel_reservations', false),
  ('receptionist', 'delete_clients', false),
  ('receptionist', 'manage_clients', true),
  ('receptionist', 'manage_payments', true),
  ('receptionist', 'manage_reservations', true),
  ('receptionist', 'manage_terrains', false),
  ('receptionist', 'view_backup', false),
  ('receptionist', 'view_calendar', true),
  ('receptionist', 'view_clients', true),
  ('receptionist', 'view_dashboard', true),
  ('receptionist', 'view_payments', true),
  ('receptionist', 'view_rapports', false),
  ('receptionist', 'view_reservations', true),
  ('receptionist', 'view_terrains', true),
  ('user', 'cancel_reservations', false),
  ('user', 'delete_clients', false),
  ('user', 'manage_clients', false),
  ('user', 'manage_payments', false),
  ('user', 'manage_reservations', false),
  ('user', 'manage_terrains', false),
  ('user', 'view_backup', false),
  ('user', 'view_calendar', true),
  ('user', 'view_clients', true),
  ('user', 'view_dashboard', false),
  ('user', 'view_payments', false),
  ('user', 'view_rapports', false),
  ('user', 'view_reservations', true),
  ('user', 'view_terrains', true)
ON CONFLICT (role, permission) DO NOTHING;


-- =====================
-- 8. REALTIME
-- =====================

ALTER PUBLICATION supabase_realtime ADD TABLE encaissements;
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
