/*
  # Enable Realtime on encaissements table

  1. Changes
    - Add `encaissements` table to Supabase Realtime publication

  2. Purpose
    - Allow all connected users to see payment updates instantly
*/

ALTER PUBLICATION supabase_realtime ADD TABLE encaissements;
