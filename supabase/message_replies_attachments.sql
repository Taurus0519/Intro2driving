ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid
  REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enforce_message_reply_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_sender_id uuid;
  parent_recipient_id uuid;
BEGIN
  IF NEW.parent_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sender_id, recipient_id
  INTO parent_sender_id, parent_recipient_id
  FROM public.messages
  WHERE id = NEW.parent_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The message being replied to does not exist or is not accessible.';
  END IF;

  IF NEW.sender_id <> parent_recipient_id OR NEW.recipient_id <> parent_sender_id THEN
    RAISE EXCEPTION 'Replies must be sent to the other participant in the original message.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_reply_participants ON public.messages;
CREATE TRIGGER enforce_message_reply_participants
  BEFORE INSERT OR UPDATE OF sender_id, recipient_id, parent_message_id
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_reply_participants();

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 52428800),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;

DROP POLICY IF EXISTS "Participants can read message attachments" ON public.message_attachments;
CREATE POLICY "Participants can read message attachments"
  ON public.message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages AS message
      WHERE message.id = message_id
        AND auth.uid() IN (message.sender_id, message.recipient_id)
    )
  );

DROP POLICY IF EXISTS "Senders can add message attachments" ON public.message_attachments;
CREATE POLICY "Senders can add message attachments"
  ON public.message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND storage_path LIKE auth.uid()::text || '/' || message_id::text || '/%'
    AND EXISTS (
      SELECT 1
      FROM public.messages AS message
      WHERE message.id = message_id
        AND message.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Senders can delete their message attachments" ON public.message_attachments;
CREATE POLICY "Senders can delete their message attachments"
  ON public.message_attachments
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('message-attachments', 'message-attachments', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload their own message attachments" ON storage.objects;
CREATE POLICY "Users can upload their own message attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Participants can read message attachment files" ON storage.objects;
CREATE POLICY "Participants can read message attachment files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments AS attachment
      JOIN public.messages AS message ON message.id = attachment.message_id
      WHERE attachment.storage_path = name
        AND auth.uid() IN (message.sender_id, message.recipient_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own message attachment files" ON storage.objects;
CREATE POLICY "Users can delete their own message attachment files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
