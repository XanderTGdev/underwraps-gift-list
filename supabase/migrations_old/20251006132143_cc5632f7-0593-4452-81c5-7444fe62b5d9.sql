-- Drop and recreate the SELECT policy on groups to allow owners to see their groups
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;

CREATE POLICY "Users can view groups they belong to"
ON public.groups
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR public.is_group_member(auth.uid(), id)
);