-- Security Fix 1: Restrict email visibility in profiles table
-- Create function to control who can view email addresses
CREATE OR REPLACE FUNCTION public.can_view_email(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Users can always view their own email
  SELECT CASE
    WHEN _viewer_id = _profile_id THEN true
    -- Group owners/admins can view emails of their group members
    WHEN EXISTS (
      SELECT 1
      FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = _viewer_id
        AND gm2.user_id = _profile_id
        AND gm1.role IN ('owner', 'admin')
    ) THEN true
    ELSE false
  END;
$$;

-- Update profiles RLS policy for SELECT to use the new function
DROP POLICY IF EXISTS "Users can view own profile and profiles of group members" ON public.profiles;

CREATE POLICY "Users can view own profile and profiles of group members"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id) OR users_share_group(auth.uid(), id)
);

-- Create a view that masks emails for non-privileged users
CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT 
  id,
  created_at,
  CASE 
    WHEN can_view_email(auth.uid(), id) THEN email
    ELSE substring(email from 1 for 1) || '***@' || split_part(email, '@', 2)
  END as email,
  name,
  avatar_url
FROM public.profiles;

-- Security Fix 2: Improve reveal date timing logic
-- Create function for robust reveal date checking
CREATE OR REPLACE FUNCTION public.is_reveal_date_reached(_reveal_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date >= _reveal_date;
$$;

-- Update item_claims RLS policies to use the new function
DROP POLICY IF EXISTS "Group members can see others claims" ON public.item_claims;
DROP POLICY IF EXISTS "Wishlist owners can see claims after reveal date" ON public.item_claims;

CREATE POLICY "Group members can see others claims"
ON public.item_claims
FOR SELECT
USING (
  (claimer_id <> auth.uid()) 
  AND (EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_members.group_id = item_claims.group_id
      AND group_members.user_id = auth.uid()
  ))
  AND (NOT (EXISTS (
    SELECT 1
    FROM items i
    JOIN wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id
      AND w.user_id = auth.uid()
      AND NOT is_reveal_date_reached(item_claims.reveal_date)
  )))
);

CREATE POLICY "Wishlist owners can see claims after reveal date"
ON public.item_claims
FOR SELECT
USING (
  is_reveal_date_reached(reveal_date)
  AND (EXISTS (
    SELECT 1
    FROM items i
    JOIN wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id
      AND w.user_id = auth.uid()
  ))
);