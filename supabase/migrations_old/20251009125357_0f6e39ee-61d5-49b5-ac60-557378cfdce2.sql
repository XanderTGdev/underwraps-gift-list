-- Fix profiles table: Convert authentication policy to RESTRICTIVE
-- This ensures it's AND'd with other policies instead of OR'd
DROP POLICY IF EXISTS "Require authentication for profile access" ON profiles;

CREATE POLICY "Require authentication for profile access"
ON profiles
AS RESTRICTIVE
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix invitations table: Make the policy more restrictive
-- Only allow group admins, inviters, and the actual invitee to view invitations
DROP POLICY IF EXISTS "Require authentication for invitation access" ON invitations;

CREATE POLICY "Only admins, inviters, and invitees can view invitations"
ON invitations
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_group_admin(auth.uid(), group_id) 
    OR inviter_id = auth.uid()
    OR invitee_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);