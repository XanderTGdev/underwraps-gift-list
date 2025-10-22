-- Fix the handle_new_group trigger to match the updated schema
-- The group_members table no longer has a role column - roles are stored in user_roles

CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the group creator as a member in group_members (without role)
  INSERT INTO public.group_members (user_id, group_id)
  VALUES (NEW.owner_id, NEW.id)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Also add to user_roles table with owner role
  INSERT INTO public.user_roles (user_id, group_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN NEW;
END;
$$;
