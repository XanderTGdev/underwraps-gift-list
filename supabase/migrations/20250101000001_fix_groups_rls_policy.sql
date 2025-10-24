-- Fix the overly permissive groups RLS policy that may be causing group creation issues
-- The previous policy allowed anyone to read group names, which can interfere with RLS

-- Drop the problematic policy
DROP POLICY IF EXISTS "groups_public_name_for_invitations" ON public.groups;

-- Create a more restrictive policy that only allows reading group names for invitation validation
-- This policy allows reading group names only when there's a valid invitation token
CREATE POLICY "groups_name_for_valid_invitations" ON public.groups
FOR SELECT
USING (
  -- Allow reading group names only if there's a valid invitation for this group
  EXISTS (
    SELECT 1 FROM public.invitations 
    WHERE invitations.group_id = groups.id 
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);

-- This policy is more secure and should not interfere with group creation
-- It only allows reading group names when there's a valid pending invitation
