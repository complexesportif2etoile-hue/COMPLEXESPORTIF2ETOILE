/*
  # Add 'terminé' status to reservations

  1. Modified Tables
    - `reservations`
      - Updated CHECK constraint on `statut` column to include 'terminé'
      - This new status is automatically applied when a reservation is fully paid

  2. Important Notes
    - The 'terminé' status indicates a reservation where payment is complete
    - Existing data is not affected
    - A database trigger automatically sets status to 'terminé' when total payments match or exceed montant_ttc
*/

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_statut_check;

ALTER TABLE reservations ADD CONSTRAINT reservations_statut_check
  CHECK (statut IN ('libre', 'réservé', 'check_in', 'check_out', 'terminé', 'annulé', 'bloqué'));

CREATE OR REPLACE FUNCTION auto_complete_reservation_on_full_payment()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric;
  reservation_total numeric;
  reservation_status text;
BEGIN
  SELECT COALESCE(SUM(montant_total), 0) INTO total_paid
  FROM encaissements
  WHERE reservation_id = NEW.reservation_id;

  SELECT montant_ttc, statut INTO reservation_total, reservation_status
  FROM reservations
  WHERE id = NEW.reservation_id;

  IF total_paid >= reservation_total AND reservation_status NOT IN ('annulé', 'bloqué') THEN
    UPDATE reservations
    SET statut = 'terminé', updated_at = now()
    WHERE id = NEW.reservation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_complete_on_payment ON encaissements;

CREATE TRIGGER trigger_auto_complete_on_payment
  AFTER INSERT ON encaissements
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_reservation_on_full_payment();
