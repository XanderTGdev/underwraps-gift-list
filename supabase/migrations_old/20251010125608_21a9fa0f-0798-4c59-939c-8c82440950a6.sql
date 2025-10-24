-- Remove the RLS policy that allows unauthenticated access
-- This is now handled by the validate-invitation edge function using service role
DROP POLICY IF EXISTS "Invitations access control" ON invitations;

-- Recreate the policy without unauthenticated access
-- Only authenticated users who are admins, inviters, or invitees can view invitations
CREATE POLICY "Invitations access control"
ON invitations
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_group_admin(auth.uid(), group_id) 
    OR inviter_id = auth.uid() 
    OR invitee_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);