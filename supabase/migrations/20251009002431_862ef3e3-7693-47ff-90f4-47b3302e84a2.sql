-- Create a security definer function to validate invitation tokens
-- This function checks the token server-side without exposing it to clients
CREATE OR REPLACE FUNCTION public.validate_invitation_token(
  _token text,
  _user_email text
)
RETURNS TABLE (
  invitation_id uuid,
  group_id uuid,
  group_name text,
  invitee_email text,
  status text,
  expires_at timestamp with time zone,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.group_id,
    g.name,
    i.invitee_email,
    i.status,
    i.expires_at,
    (
      i.status = 'pending' 
      AND i.expires_at > now() 
      AND i.invitee_email = _user_email
    ) as is_valid
  FROM invitations i
  JOIN groups g ON g.id = i.group_id
  WHERE i.token = _token;
END;
$$;

-- Update RLS policy to prevent token exposure
-- Remove the old policy that allowed invitees to see their invitations
DROP POLICY IF EXISTS "Users can view invitations they sent or received" ON invitations;

-- Create new policy that only allows inviters to see invitation details (without token)
-- Note: Invitees will use the validate_invitation_token function instead
CREATE POLICY "Inviters and group admins can view invitations"
ON invitations
FOR SELECT
USING (
  inviter_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = invitations.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('owner', 'admin')
  )
);

-- Add DELETE policy to allow cleanup of old invitations
CREATE POLICY "Inviters and admins can delete invitations"
ON invitations
FOR DELETE
USING (
  inviter_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = invitations.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('owner', 'admin')
  )
);

-- Update the UPDATE policy to allow invitees to update their invitations
-- This is needed for accepting invitations
DROP POLICY IF EXISTS "Inviters and admins can update invitations" ON invitations;

CREATE POLICY "Inviters, admins, and invitees can update invitations"
ON invitations
FOR UPDATE
USING (
  inviter_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = invitations.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('owner', 'admin')
  )
  OR
  (
    invitee_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);