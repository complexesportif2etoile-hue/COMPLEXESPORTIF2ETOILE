/*
  # Replace restore_backup function - Add role_permissions support

  ## Summary
  Drops the old restore_backup function and creates a new version with:

  1. **New parameter**
     - `p_role_permissions`: Restores role-based permission settings

  2. **Correct ordering**
     - Delete: encaissements → factures → payments → reservations → clients → terrains → company_settings
     - Insert: terrains → clients → reservations → encaissements → factures → payments → company_settings → deposit_settings → role_permissions

  3. **Security**
     - SECURITY DEFINER preserved (bypasses RLS for admin restore)
     - search_path locked to public
     - Only authenticated users can call this function
*/

DROP FUNCTION IF EXISTS public.restore_backup(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.restore_backup(
  p_terrains jsonb DEFAULT '[]',
  p_clients jsonb DEFAULT '[]',
  p_reservations jsonb DEFAULT '[]',
  p_encaissements jsonb DEFAULT '[]',
  p_factures jsonb DEFAULT '[]',
  p_payments jsonb DEFAULT '[]',
  p_company_settings jsonb DEFAULT '[]',
  p_deposit_settings jsonb DEFAULT '[]',
  p_role_permissions jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_errors text[] := ARRAY[]::text[];
  v_row jsonb;
BEGIN
  DELETE FROM encaissements;
  DELETE FROM factures;
  DELETE FROM payments;
  DELETE FROM reservations;
  DELETE FROM clients;
  DELETE FROM terrains;
  DELETE FROM company_settings;

  IF jsonb_array_length(p_terrains) > 0 THEN
    BEGIN
      INSERT INTO terrains
      SELECT * FROM jsonb_populate_recordset(null::terrains, p_terrains);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'terrains: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_clients) > 0 THEN
    BEGIN
      INSERT INTO clients
      SELECT * FROM jsonb_populate_recordset(null::clients, p_clients);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'clients: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_reservations) > 0 THEN
    BEGIN
      INSERT INTO reservations
      SELECT * FROM jsonb_populate_recordset(null::reservations, p_reservations);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'reservations: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_encaissements) > 0 THEN
    BEGIN
      INSERT INTO encaissements
      SELECT * FROM jsonb_populate_recordset(null::encaissements, p_encaissements);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'encaissements: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_factures) > 0 THEN
    BEGIN
      INSERT INTO factures
      SELECT * FROM jsonb_populate_recordset(null::factures, p_factures);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'factures: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_payments) > 0 THEN
    BEGIN
      INSERT INTO payments
      SELECT * FROM jsonb_populate_recordset(null::payments, p_payments);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'payments: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_company_settings) > 0 THEN
    BEGIN
      INSERT INTO company_settings
      SELECT * FROM jsonb_populate_recordset(null::company_settings, p_company_settings);
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'company_settings: ' || SQLERRM);
    END;
  END IF;

  IF jsonb_array_length(p_deposit_settings) > 0 THEN
    BEGIN
      FOR v_row IN SELECT * FROM jsonb_array_elements(p_deposit_settings)
      LOOP
        INSERT INTO deposit_settings
        SELECT * FROM jsonb_populate_record(null::deposit_settings, v_row)
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
      FOR v_row IN SELECT * FROM jsonb_array_elements(p_role_permissions)
      LOOP
        INSERT INTO role_permissions
        SELECT * FROM jsonb_populate_record(null::role_permissions, v_row)
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

REVOKE ALL ON FUNCTION public.restore_backup FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup TO authenticated;
