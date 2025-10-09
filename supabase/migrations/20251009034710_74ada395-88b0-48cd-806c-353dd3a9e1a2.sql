-- Phase 1: Critical Security Fix - Role System Refactoring
-- This migration creates a secure role system separated from group membership

-- Step 1: Create app_role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');

-- Step 2: Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, group_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _group_id uuid, _role public.app_role)
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
      AND group_id = _group_id
      AND role = _role
  );
$$;

-- Helper function to check if user has owner or admin role
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
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
      AND group_id = _group_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Step 4: Migrate existing role data from group_members to user_roles
INSERT INTO public.user_roles (user_id, group_id, role)
SELECT 
  user_id, 
  group_id, 
  CASE 
    WHEN role = 'owner' THEN 'owner'::public.app_role
    WHEN role = 'admin' THEN 'admin'::public.app_role
    ELSE 'member'::public.app_role
  END as role
FROM public.group_members
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Step 5: Drop old RLS policies that reference group_members.role
DROP POLICY IF EXISTS "Group owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Users can remove themselves or admins can remove others" ON public.group_members;
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Group owners and admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "Inviters and group admins can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Inviters and admins can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Inviters, admins, and invitees can update invitations" ON public.invitations;

-- Step 6: Create new RLS policies for user_roles table
CREATE POLICY "Users can view roles in their groups"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = user_roles.group_id
      AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Group admins can assign roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Group admins can update roles"
ON public.user_roles
FOR UPDATE
USING (
  is_group_admin(auth.uid(), group_id) AND
  user_id <> auth.uid()  -- Can't change own role
);

CREATE POLICY "Group admins can remove roles"
ON public.user_roles
FOR DELETE
USING (
  is_group_admin(auth.uid(), group_id) AND
  user_id <> auth.uid()  -- Can't remove own role
);

-- Step 7: Recreate RLS policies using has_role and is_group_admin functions
CREATE POLICY "Group admins can add members"
ON public.group_members
FOR INSERT
WITH CHECK (is_group_admin(auth.uid(), group_id));

CREATE POLICY "Users can remove themselves or admins can remove others"
ON public.group_members
FOR DELETE
USING (
  user_id = auth.uid() OR
  is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Group admins can update groups"
ON public.groups
FOR UPDATE
USING (is_group_admin(auth.uid(), id));

CREATE POLICY "Group admins can view invitations"
ON public.invitations
FOR SELECT
USING (
  inviter_id = auth.uid() OR
  is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Group admins can delete invitations"
ON public.invitations
FOR DELETE
USING (
  inviter_id = auth.uid() OR
  is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Inviters, admins, and invitees can update invitations"
ON public.invitations
FOR UPDATE
USING (
  inviter_id = auth.uid() OR
  is_group_admin(auth.uid(), group_id) OR
  invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Step 8: Update get_user_group_role function to use user_roles table
DROP FUNCTION IF EXISTS public.get_user_group_role(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_user_group_role(_user_id uuid, _group_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
    AND group_id = _group_id
  LIMIT 1;
$$;

-- Step 9: Remove role column from group_members (data already migrated)
ALTER TABLE public.group_members DROP COLUMN IF EXISTS role;

-- Step 10: Update can_view_email function to use is_group_admin
DROP FUNCTION IF EXISTS public.can_view_email(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_view_email(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Users can always view their own email
    WHEN _viewer_id = _profile_id THEN true
    -- Group admins can view emails of their group members
    WHEN EXISTS (
      SELECT 1
      FROM user_roles ur1
      JOIN group_members gm ON ur1.group_id = gm.group_id
      WHERE ur1.user_id = _viewer_id
        AND gm.user_id = _profile_id
        AND ur1.role IN ('owner', 'admin')
    ) THEN true
    ELSE false
  END;
$$;

-- Step 11: Update profiles RLS policy to properly restrict email visibility
DROP POLICY IF EXISTS "Users can view own profile and profiles of group members" ON public.profiles;

CREATE POLICY "Users can view profiles with restricted email access"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR
  users_share_group(auth.uid(), id)
);