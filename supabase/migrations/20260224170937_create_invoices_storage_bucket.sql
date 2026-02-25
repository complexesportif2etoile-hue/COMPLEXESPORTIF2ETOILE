/*
  # Create invoices storage bucket

  1. New Storage Bucket
    - `invoices` - public bucket to store generated invoice PDFs
      - Files are publicly readable so they can be shared via WhatsApp links
      - Only authenticated users can upload

  2. Security
    - Public read access for sharing links
    - Authenticated users can upload/delete their own files
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Public can read invoices"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete own invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');
