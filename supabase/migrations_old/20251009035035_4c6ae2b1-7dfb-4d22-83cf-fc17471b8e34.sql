-- Fix users_share_group function to handle edge cases and validate group membership properly
-- Using CREATE OR REPLACE to avoid dependency issues

CREATE OR REPLACE FUNCTION public.users_share_group(_user_id_1 uuid, _user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Return false if either user_id is NULL
  SELECT CASE 
    WHEN _user_id_1 IS NULL OR _user_id_2 IS NULL THEN false
    -- Check if both users are members of the same group AND that group exists
    ELSE EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      JOIN public.groups g ON g.id = gm1.group_id
      WHERE gm1.user_id = _user_id_1
        AND gm2.user_id = _user_id_2
        -- Ensure both memberships are active (not deleted)
        AND gm1.id IS NOT NULL
        AND gm2.id IS NOT NULL
        -- Ensure the group exists (join to groups table validates this)
        AND g.id IS NOT NULL
    )
  END;
$$;

-- Add a comment explaining the function's security considerations
COMMENT ON FUNCTION public.users_share_group(uuid, uuid) IS 
'Returns true if two users share at least one active group. 
Validates that:
1. Both user_ids are non-null
2. Both users are active members in group_members table
3. The group itself exists in the groups table
4. Used by RLS policies to control profile visibility between group members';