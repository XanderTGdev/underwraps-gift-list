-- Debug and fix invitation acceptance issue
-- First, ensure the helper function exists
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Drop the old restrictive admin-only policies if they exist
-- (from earlier migrations before invitation support was added)
DROP POLICY IF EXISTS "Group owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;

-- Drop and recreate the invitation policy to ensure it's properly configured
DROP POLICY IF EXISTS "Invited users can add themselves when accepting invitations" ON public.group_members;

CREATE POLICY "Invited users can add themselves when accepting invitations"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only add themselves
  user_id = auth.uid()
  AND
  -- Must have a valid pending invitation for this group
  EXISTS (
    SELECT 1 FROM public.invitations
    WHERE invitations.group_id = group_members.group_id
    AND invitations.invitee_email = public.get_current_user_email()
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);

