-- Fix references to the non-existent role column in group_members
-- The role column was already dropped, so any attempts to reference it will fail

-- The logic in previous migrations tried to migrate roles from group_members to user_roles,
-- but the column is already gone. This just ensures consistency in user_roles.

-- Ensure that any group members without a corresponding user_roles entry get the member role
INSERT INTO public.user_roles (user_id, group_id, role)
SELECT
  gm.user_id,
  gm.group_id,
  CASE
    -- Check if they're the group owner - if so, they should be 'owner'
    WHEN g.owner_id = gm.user_id THEN 'owner'::public.app_role
    -- Otherwise default to 'member'
    ELSE 'member'::public.app_role
  END as role
FROM public.group_members gm
INNER JOIN public.groups g ON gm.group_id = g.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = gm.user_id AND ur.group_id = gm.group_id
)
ON CONFLICT (user_id, group_id) DO NOTHING;
