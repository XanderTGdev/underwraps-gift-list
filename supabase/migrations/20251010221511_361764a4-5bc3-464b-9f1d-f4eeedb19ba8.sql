-- Add support for global admin roles (user_roles with null group_id)
-- Allow group_id to be null for global admin roles
ALTER TABLE user_roles ALTER COLUMN group_id DROP NOT NULL;

-- Add a check constraint to ensure either group_id is null (global) or not null (group-specific)
ALTER TABLE user_roles ADD CONSTRAINT valid_role_scope 
  CHECK (
    (group_id IS NULL AND role = 'admin') OR 
    (group_id IS NOT NULL)
  );

-- Create function to check if user is a global admin
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND group_id IS NULL
      AND role = 'admin'
  );
$$;

-- Add RLS policies for global admins to view all profiles
CREATE POLICY "Global admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (is_global_admin(auth.uid()));

-- Add RLS policies for global admins to view all groups
CREATE POLICY "Global admins can view all groups"
ON groups
FOR SELECT
TO authenticated
USING (is_global_admin(auth.uid()));

-- Add RLS policies for global admins to view all group members
CREATE POLICY "Global admins can view all group members"
ON group_members
FOR SELECT
TO authenticated
USING (is_global_admin(auth.uid()));

-- Add RLS policies for global admins to manage user roles
CREATE POLICY "Global admins can view all user roles"
ON user_roles
FOR SELECT
TO authenticated
USING (is_global_admin(auth.uid()));

CREATE POLICY "Global admins can update user roles"
ON user_roles
FOR UPDATE
TO authenticated
USING (is_global_admin(auth.uid()))
WITH CHECK (is_global_admin(auth.uid()));

CREATE POLICY "Global admins can insert user roles"
ON user_roles
FOR INSERT
TO authenticated
WITH CHECK (is_global_admin(auth.uid()));

CREATE POLICY "Global admins can delete user roles"
ON user_roles
FOR DELETE
TO authenticated
USING (is_global_admin(auth.uid()));

-- Add RLS policies for global admins to delete profiles
CREATE POLICY "Global admins can delete profiles"
ON profiles
FOR DELETE
TO authenticated
USING (is_global_admin(auth.uid()));