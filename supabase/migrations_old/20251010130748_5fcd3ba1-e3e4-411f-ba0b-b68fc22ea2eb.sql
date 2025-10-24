-- Fix RLS policy to allow invitees to update invitation status when accepting
-- The current policy checks invitee_email against the profiles table, but that requires
-- the user to already have a matching email in profiles, which may not happen immediately

DROP POLICY IF EXISTS "Inviters, admins, and invitees can update invitations" ON invitations;

CREATE POLICY "Inviters, admins, and invitees can update invitations"
ON invitations
FOR UPDATE
USING (
  inviter_id = auth.uid() 
  OR is_group_admin(auth.uid(), group_id)
  OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  inviter_id = auth.uid() 
  OR is_group_admin(auth.uid(), group_id)
  OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);