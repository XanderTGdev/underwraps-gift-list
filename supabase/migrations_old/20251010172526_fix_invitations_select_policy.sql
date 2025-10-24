-- Fix the root cause: invitations SELECT policy relies on profiles table
-- which may not exist yet for brand new users
-- 
-- The issue: When a new user tries to accept an invitation, the INSERT policy
-- on group_members queries invitations, but the RESTRICTIVE SELECT policy on
-- invitations checks profiles table, which might not have the user yet.
-- 
-- Solution: Use get_current_user_email() which queries auth.users directly

-- Drop the problematic restrictive policy
DROP POLICY IF EXISTS "Only admins, inviters, and invitees can view invitations" ON invitations;

-- Recreate it using get_current_user_email() instead of profiles lookup
CREATE POLICY "Only admins, inviters, and invitees can view invitations"
ON invitations
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_group_admin(auth.uid(), group_id) 
    OR inviter_id = auth.uid()
    OR invitee_email = public.get_current_user_email()  -- Use helper function instead of profiles table
  )
);

