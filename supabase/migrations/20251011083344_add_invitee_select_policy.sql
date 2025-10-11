-- Add explicit permissive SELECT policy allowing invitees to see their own invitations

-- Ensure helper exists
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Add a permissive policy specifically for invitees by email
CREATE POLICY "Invitees can view their invitations by email"
ON invitations
FOR SELECT
USING (
  invitee_email = public.get_current_user_email()
);


