-- Create a function to automatically add the group creator as an owner member
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the group creator as an owner in group_members
  INSERT INTO public.group_members (user_id, group_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Create trigger to execute the function after a group is created
DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group();