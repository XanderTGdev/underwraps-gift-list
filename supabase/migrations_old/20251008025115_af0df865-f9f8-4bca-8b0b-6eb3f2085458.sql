-- Create UPDATE policy for group_members table
-- Only owners and admins can modify member roles
-- Users cannot escalate their own role
CREATE POLICY "Owners and admins can update member roles"
ON public.group_members
FOR UPDATE
TO authenticated
USING (
  -- The user performing the update must be an owner or admin of the group
  get_user_group_role(auth.uid(), group_id) = ANY (ARRAY['owner'::text, 'admin'::text])
)
WITH CHECK (
  -- The user performing the update must be an owner or admin of the group
  get_user_group_role(auth.uid(), group_id) = ANY (ARRAY['owner'::text, 'admin'::text])
  AND
  -- Additional protection: prevent users from modifying their own role
  -- (This prevents even admins from self-escalating to owner)
  user_id != auth.uid()
);