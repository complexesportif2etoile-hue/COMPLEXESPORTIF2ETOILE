/*
  # Fix unindexed foreign keys

  ## Changes
  - Add index on `depenses.created_by` to cover the `depenses_created_by_fkey` foreign key
  - Add index on `payments.validated_by` to cover the `payments_validated_by_fkey` foreign key

  These indexes improve query performance when joining or filtering by these foreign key columns.
*/

CREATE INDEX IF NOT EXISTS idx_depenses_created_by ON public.depenses(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_validated_by ON public.payments(validated_by);
