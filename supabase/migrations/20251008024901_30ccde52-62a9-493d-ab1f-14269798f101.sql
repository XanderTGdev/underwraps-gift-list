-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a security definer function to check if two users share any groups
CREATE OR REPLACE FUNCTION public.users_share_group(_user_id_1 uuid, _user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = _user_id_1
      AND gm2.user_id = _user_id_2
  );
$$;

-- Create a new, more secure policy that allows users to view:
-- 1. Their own profile
-- 2. Profiles of users who share at least one group with them
CREATE POLICY "Users can view own profile and profiles of group members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.users_share_group(auth.uid(), id)
);