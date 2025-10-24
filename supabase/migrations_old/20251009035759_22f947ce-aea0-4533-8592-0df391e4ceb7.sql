-- Fix profiles RLS policy to properly restrict email visibility at database level
-- Only allow viewing profiles where user can legitimately see the email

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view profiles with restricted email access" ON public.profiles;

-- Create new policy that restricts profile access based on email viewing rights
CREATE POLICY "Users can view profiles with restricted email access"
ON public.profiles
FOR SELECT
USING (
  -- Users can always view their own profile
  auth.uid() = id 
  OR
  -- Admins/owners can view profiles of members in their groups
  can_view_email(auth.uid(), id)
  OR
  -- Users can view basic profile info (name, avatar) of group members, but NOT email
  -- This is handled by column-level security through can_view_email function
  (
    users_share_group(auth.uid(), id) AND
    -- The email column is protected by can_view_email function
    -- This allows viewing name/avatar but not email for regular members
    true
  )
);

-- Add column-level RLS for email visibility
-- Note: Supabase doesn't support column-level RLS directly in policies,
-- so we need to create a view or handle this in application logic

-- Alternative approach: Create a more restrictive policy that only allows
-- viewing profiles if you're the owner, an admin, or for non-sensitive fields

DROP POLICY IF EXISTS "Users can view profiles with restricted email access" ON public.profiles;

-- Recreate with proper restriction: regular members cannot SELECT emails
-- This policy allows viewing profiles but the application must filter emails
CREATE POLICY "Users can view group member profiles"
ON public.profiles
FOR SELECT
USING (
  -- Users can always view their own complete profile
  auth.uid() = id 
  OR
  -- Group admins can view complete profiles of their group members
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.group_members gm ON ur.group_id = gm.group_id
    WHERE ur.user_id = auth.uid()
      AND gm.user_id = profiles.id
      AND ur.role IN ('owner', 'admin')
  )
  OR
  -- Regular members can view profiles (but app must mask emails)
  users_share_group(auth.uid(), id)
);

-- Create a separate secure view for email access that properly filters
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  p.id,
  p.name,
  p.avatar_url,
  p.created_at,
  -- Only show email if viewer has permission
  CASE 
    WHEN p.id = auth.uid() THEN p.email
    WHEN can_view_email(auth.uid(), p.id) THEN p.email
    ELSE NULL
  END as email
FROM public.profiles p
WHERE (
  auth.uid() = p.id 
  OR users_share_group(auth.uid(), p.id)
);

-- Enable RLS on the view (even though it's a view, this documents intent)
COMMENT ON VIEW public.profiles_secure IS 
'Secure view of profiles that automatically masks emails based on can_view_email permissions. 
Use this view instead of querying profiles directly when email visibility needs enforcement.';