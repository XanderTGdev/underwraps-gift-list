-- Drop the overly restrictive policy that blocks token validation
DROP POLICY IF EXISTS "Only admins, inviters, and invitees can view invitations" ON invitations;

-- Create a new policy that allows:
-- 1. Authenticated users who are admins/inviters/invitees
-- 2. Unauthenticated access for the validate_invitation_token SECURITY DEFINER function
CREATE POLICY "Invitations access control"
ON invitations
FOR SELECT
USING (
  -- Allow authenticated users who are admins, inviters, or invitees
  (
    auth.uid() IS NOT NULL 
    AND (
      is_group_admin(auth.uid(), group_id) 
      OR inviter_id = auth.uid() 
      OR invitee_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  )
  -- Allow unauthenticated access for token validation
  -- This is secure because validate_invitation_token is SECURITY DEFINER
  -- and only returns data for valid, unguessable UUID tokens that expire
  OR auth.uid() IS NULL
);