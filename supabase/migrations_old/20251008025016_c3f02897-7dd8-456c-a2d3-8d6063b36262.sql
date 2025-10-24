-- Drop the overly permissive SELECT policy that exposes tokens to all group members
DROP POLICY IF EXISTS "Users can view invitations for their groups" ON public.invitations;

-- Create a new, secure policy that only allows:
-- 1. The inviter to view their sent invitations
-- 2. The invitee (matched by email) to view invitations sent to them
CREATE POLICY "Users can view invitations they sent or received"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  -- User is the inviter
  inviter_id = auth.uid()
  OR
  -- User's email matches the invitee_email
  invitee_email = (
    SELECT email 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);