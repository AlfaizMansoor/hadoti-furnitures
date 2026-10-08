-- Table to store Contact Us form submissions.
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors) can submit the contact form.
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
ON public.contact_messages FOR INSERT
WITH CHECK (true);

-- Only admins can read submitted messages.
DROP POLICY IF EXISTS "Admins can read contact messages" ON public.contact_messages;
CREATE POLICY "Admins can read contact messages"
ON public.contact_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
);

-- Only admins can mark messages as read.
DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages"
ON public.contact_messages FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
);
