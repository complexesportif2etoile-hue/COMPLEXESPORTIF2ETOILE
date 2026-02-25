/*
  # Mise à jour des politiques RLS pour les champs de paiement

  ## Résumé
  La politique d'INSERT public sur `reservations` doit maintenant accepter
  les nouveaux champs de paiement tout en maintenant les contraintes de sécurité.

  ## Changements
  - Suppression de l'ancienne politique restrictive pour les inserts publics
  - Recréation avec acceptation des nouveaux champs payment_status, payment_method,
    amount_due, amount_paid, deposit_amount

  ## Notes
  - Les réservations publiques doivent toujours avoir statut = 'en_attente'
  - payment_status peut être UNPAID, PARTIAL ou PAID selon le flux
  - payment_method indique le canal choisi par le client
*/

-- Supprimer l'ancienne politique d'insert public
DROP POLICY IF EXISTS "Public can insert reservations with en_attente status" ON reservations;

-- Recréer avec les nouveaux champs autorisés
CREATE POLICY "Public can insert reservations with en_attente status"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (
    statut = 'en_attente'
    AND created_by IS NULL
    AND payment_method IN ('ON_SITE', 'WAVE', 'ORANGE_MONEY')
    AND payment_status IN ('UNPAID', 'PARTIAL', 'PAID')
    AND amount_due >= 0
    AND amount_paid >= 0
    AND deposit_amount >= 0
  );
