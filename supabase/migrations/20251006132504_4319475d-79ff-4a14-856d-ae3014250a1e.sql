-- Update the function to handle duplicate insertions gracefully
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the group creator as an owner in group_members
  -- Use ON CONFLICT to avoid errors if the entry already exists
  INSERT INTO public.group_members (user_id, group_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;