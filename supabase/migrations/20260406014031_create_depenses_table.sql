/*
  # Création de la table depenses

  ## Résumé
  Création d'une table pour gérer les dépenses/charges du complexe sportif,
  permettant de calculer le bénéfice net (encaissements - dépenses).

  ## Nouvelle table
  - `depenses`
    - `id` (uuid, clé primaire)
    - `libelle` (text) : description de la dépense
    - `montant` (numeric) : montant de la dépense
    - `categorie` (text) : catégorie (salaires, entretien, electricite, eau, loyer, equipement, autre)
    - `date_depense` (date) : date de la dépense
    - `notes` (text) : notes optionnelles
    - `created_by` (uuid, FK profiles) : utilisateur ayant saisi la dépense
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Sécurité
  - RLS activé
  - Lecture : utilisateurs authentifiés
  - Insertion/Modification/Suppression : admin et manager uniquement
*/

CREATE TABLE IF NOT EXISTS depenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL DEFAULT '',
  montant numeric NOT NULL DEFAULT 0,
  categorie text NOT NULL DEFAULT 'autre'
    CHECK (categorie = ANY (ARRAY[
      'salaires', 'entretien', 'electricite', 'eau',
      'loyer', 'equipement', 'fournitures', 'autre'
    ])),
  date_depense date NOT NULL DEFAULT CURRENT_DATE,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view depenses"
  ON depenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can insert depenses"
  ON depenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update depenses"
  ON depenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can delete depenses"
  ON depenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE INDEX IF NOT EXISTS depenses_date_depense_idx ON depenses (date_depense);
CREATE INDEX IF NOT EXISTS depenses_categorie_idx ON depenses (categorie);
