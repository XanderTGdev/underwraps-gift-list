-- Drop existing problematic policies
DROP POLICY IF EXISTS "Group owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON public.group_members;
DROP POLICY IF EXISTS "Users can remove themselves or admins can remove others" ON public.group_members;

-- Create security definer function to get user's role in a group
CREATE OR REPLACE FUNCTION public.get_user_group_role(_user_id uuid, _group_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.group_members
  WHERE user_id = _user_id
    AND group_id = _group_id
  LIMIT 1;
$$;

-- Create security definer function to check if user is member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  );
$$;

-- Recreate SELECT policy using the security definer function
CREATE POLICY "Users can view members of groups they belong to"
ON public.group_members
FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_group_member(auth.uid(), group_id)
);

-- Recreate INSERT policy using the security definer function
CREATE POLICY "Group owners and admins can add members"
ON public.group_members
FOR INSERT
WITH CHECK (
  public.get_user_group_role(auth.uid(), group_id) IN ('owner', 'admin')
);

-- Recreate DELETE policy using the security definer function
CREATE POLICY "Users can remove themselves or admins can remove others"
ON public.group_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.get_user_group_role(auth.uid(), group_id) IN ('owner', 'admin')
);