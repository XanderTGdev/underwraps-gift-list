-- Create a security definer function to get the current user's email
-- This is needed because regular users can't query auth.users directly
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Update the RLS policy on invitations to use the security definer function
DROP POLICY IF EXISTS "Inviters, admins, and invitees can update invitations" ON invitations;

CREATE POLICY "Inviters, admins, and invitees can update invitations"
ON invitations
FOR UPDATE
USING (
  inviter_id = auth.uid() 
  OR is_group_admin(auth.uid(), group_id)
  OR invitee_email = get_current_user_email()
)
WITH CHECK (
  inviter_id = auth.uid() 
  OR is_group_admin(auth.uid(), group_id)
  OR invitee_email = get_current_user_email()
);

-- Update the RLS policy on group_members to use the security definer function
DROP POLICY IF EXISTS "Invited users can add themselves when accepting invitations" ON group_members;

CREATE POLICY "Invited users can add themselves when accepting invitations"
ON group_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND
  EXISTS (
    SELECT 1 FROM invitations
    WHERE invitations.group_id = group_members.group_id
    AND invitations.invitee_email = get_current_user_email()
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);