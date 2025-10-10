-- Allow invited users to add themselves to groups when accepting invitations
-- This policy allows users to insert themselves into group_members if they have a valid pending invitation

CREATE POLICY "Invited users can add themselves when accepting invitations"
ON group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only add themselves
  user_id = auth.uid()
  AND
  -- Must have a valid pending invitation for this group
  EXISTS (
    SELECT 1 FROM invitations
    WHERE invitations.group_id = group_members.group_id
    AND invitations.invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);