-- Fix the profiles_secure view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures RLS is enforced from the querying user's perspective

DROP VIEW IF EXISTS public.profiles_secure;

CREATE OR REPLACE VIEW public.profiles_secure
WITH (security_invoker = on)
AS
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

COMMENT ON VIEW public.profiles_secure IS 
'Secure view of profiles that automatically masks emails based on can_view_email permissions. 
Uses security_invoker=on to enforce RLS from the querying user perspective.
Use this view instead of querying profiles directly when email visibility needs enforcement.';