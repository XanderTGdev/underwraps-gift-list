-- Phase 1: Add authentication requirements to prevent anonymous access
CREATE POLICY "Require authentication for profile access"
ON profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Require authentication for invitation access"
ON invitations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Drop the unusable profiles_secure view
DROP VIEW IF EXISTS profiles_secure;

-- Phase 2: Create trigger for automatic role assignment
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is the group owner
  IF EXISTS (
    SELECT 1 FROM groups
    WHERE id = NEW.group_id
    AND owner_id = NEW.user_id
  ) THEN
    -- Assign owner role
    INSERT INTO public.user_roles (user_id, group_id, role)
    VALUES (NEW.user_id, NEW.group_id, 'owner')
    ON CONFLICT (user_id, group_id) DO NOTHING;
  ELSE
    -- Assign member role
    INSERT INTO public.user_roles (user_id, group_id, role)
    VALUES (NEW.user_id, NEW.group_id, 'member')
    ON CONFLICT (user_id, group_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_member_added
  AFTER INSERT ON group_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_member();

-- Phase 3: Backfill missing roles for existing members
INSERT INTO user_roles (user_id, group_id, role)
SELECT 
  gm.user_id,
  gm.group_id,
  CASE 
    WHEN g.owner_id = gm.user_id THEN 'owner'::app_role
    ELSE 'member'::app_role
  END as role
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
LEFT JOIN user_roles ur ON gm.user_id = ur.user_id AND gm.group_id = ur.group_id
WHERE ur.id IS NULL
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Phase 4: Enhanced security measures
-- Add unique constraint on user_roles (if not exists)
ALTER TABLE user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_group_unique;

ALTER TABLE user_roles
ADD CONSTRAINT user_roles_user_group_unique 
UNIQUE (user_id, group_id);

-- Add cascade delete for role cleanup
CREATE OR REPLACE FUNCTION public.handle_member_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete corresponding role assignment
  DELETE FROM public.user_roles
  WHERE user_id = OLD.user_id
  AND group_id = OLD.group_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_group_member_removed
  BEFORE DELETE ON group_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_member_removal();

-- Add input length limits
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS group_name_length;

ALTER TABLE groups 
ADD CONSTRAINT group_name_length CHECK (char_length(name) <= 100 AND char_length(name) >= 1);

ALTER TABLE items
DROP CONSTRAINT IF EXISTS item_title_length;

ALTER TABLE items
ADD CONSTRAINT item_title_length CHECK (char_length(title) <= 500);

ALTER TABLE items
DROP CONSTRAINT IF EXISTS item_note_length;

ALTER TABLE items
ADD CONSTRAINT item_note_length CHECK (char_length(note) <= 2000);