-- ============================================================================
-- CONSOLIDATED MIGRATION FOR UNDERWRAPS GIFT LIST
-- ============================================================================
-- This file represents the complete, final state of the database schema.
-- It consolidates 33+ incremental migrations into one clean baseline.
--
-- Created: October 23, 2025
-- Purpose: Fresh Supabase project setup
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE CUSTOM TYPES
-- ============================================================================

-- App role enum for user permissions within groups
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');

-- ============================================================================
-- STEP 2: CREATE TABLES
-- ============================================================================

-- Profiles table: Extended user information beyond auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Groups table: Wishlist sharing groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  CONSTRAINT group_name_length CHECK (char_length(name) <= 100 AND char_length(name) >= 1)
);

-- Group members table: Users who belong to groups
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  UNIQUE(group_id, user_id)
);

-- Add foreign key constraint for groups.owner_id (after group_members exists)
ALTER TABLE public.groups ADD CONSTRAINT groups_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- User roles table: Separate role management for security
-- Roles are managed separately from membership to allow flexible security policies
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE, -- Nullable for global admins
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  UNIQUE(user_id, group_id),
  -- Global admins have NULL group_id
  CONSTRAINT valid_role_scope CHECK (
    (group_id IS NULL AND role = 'admin') OR 
    (group_id IS NOT NULL)
  )
);

-- Invitations table: Group invitation management
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitee_email text NOT NULL,
  token text UNIQUE NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz
);

-- Wishlists table: User wishlists within groups
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'My Wishlist',
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  UNIQUE(user_id, group_id, name)
);

-- Items table: Individual wishlist items
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE CASCADE NOT NULL,
  url text, -- Made nullable
  title text,
  price numeric(12,2),
  currency text DEFAULT 'USD',
  image_url text,
  note text,
  quantity int DEFAULT 1 NOT NULL,
  allow_multiple_claims boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  CONSTRAINT item_title_length CHECK (char_length(title) <= 500),
  CONSTRAINT item_note_length CHECK (char_length(note) <= 2000)
);

-- Item claims table: Who's buying what for whom
CREATE TABLE public.item_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  claimer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  note text,
  reveal_date date NOT NULL, -- When the wishlist owner can see the claim
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  UNIQUE(item_id, claimer_id)
);

-- ============================================================================
-- STEP 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX idx_wishlists_group ON public.wishlists(group_id);
CREATE INDEX idx_items_wishlist ON public.items(wishlist_id);
CREATE INDEX idx_items_created ON public.items(created_at DESC);
CREATE INDEX idx_claims_item ON public.item_claims(item_id);
CREATE INDEX idx_claims_group ON public.item_claims(group_id);
CREATE INDEX idx_claims_reveal ON public.item_claims(reveal_date);

-- ============================================================================
-- STEP 4: CREATE FUNCTIONS
-- ============================================================================

-- Get current user's email from auth.users (needed for RLS policies)
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Check if user is a member of a group
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

-- Check if two users share at least one group
CREATE OR REPLACE FUNCTION public.users_share_group(_user_id_1 uuid, _user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id_1 IS NULL OR _user_id_2 IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      JOIN public.groups g ON g.id = gm1.group_id
      WHERE gm1.user_id = _user_id_1
        AND gm2.user_id = _user_id_2
        AND gm1.id IS NOT NULL
        AND gm2.id IS NOT NULL
        AND g.id IS NOT NULL
    )
  END;
$$;

-- Check if user has a specific role in a group
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

-- Check if user is a group admin (owner or admin role)
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

-- Check if user is a global admin
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

-- Get user's role in a group (returns text for compatibility)
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

-- Check if viewer can view profile's email (admins can see member emails)
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

-- Check if reveal date has been reached (timezone-aware)
CREATE OR REPLACE FUNCTION public.is_reveal_date_reached(_reveal_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date >= _reveal_date;
$$;

-- Validate invitation token (secure server-side validation)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(
  _token text,
  _user_email text
)
RETURNS TABLE (
  invitation_id uuid,
  group_id uuid,
  group_name text,
  invitee_email text,
  status text,
  expires_at timestamp with time zone,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.group_id,
    g.name,
    i.invitee_email,
    i.status,
    i.expires_at,
    (
      i.status = 'pending' 
      AND i.expires_at > now() 
      AND i.invitee_email = _user_email
    ) as is_valid
  FROM invitations i
  JOIN groups g ON g.id = i.group_id
  WHERE i.token = _token;
END;
$$;

-- Safely upsert user role (used by edge functions)
CREATE OR REPLACE FUNCTION public.upsert_user_role_safe(
  p_user_id uuid,
  p_group_id uuid,
  p_role public.app_role DEFAULT 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, group_id, role)
  VALUES (p_user_id, p_group_id, p_role)
  ON CONFLICT (user_id, group_id) DO NOTHING;
END;
$$;

-- ============================================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================================

-- Trigger: Auto-create profile when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Auto-add group creator as owner when group is created
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add group creator as member
  INSERT INTO public.group_members (user_id, group_id)
  VALUES (NEW.owner_id, NEW.id)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- Add owner role
  INSERT INTO public.user_roles (user_id, group_id, role)
  VALUES (NEW.owner_id, NEW.id, 'owner')
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- Trigger: Auto-assign role when new member is added
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();

-- Trigger: Clean up role when member is removed
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_removal();

-- ============================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_claims ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: CREATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own profile
-- Users can view profiles of other users they share groups with
-- Global admins can view all profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR users_share_group(auth.uid(), id)
  OR is_global_admin(auth.uid())
);

-- Users can insert their own profile (triggered by signup)
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Only global admins can delete profiles
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE
USING (is_global_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- GROUPS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view groups they're members of
-- Global admins can view all groups
CREATE POLICY "groups_select_policy" ON public.groups
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR is_group_member(auth.uid(), id)
  OR is_global_admin(auth.uid())
);

-- Authenticated users can create groups
CREATE POLICY "groups_insert_policy" ON public.groups
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

-- Group admins can update their groups
CREATE POLICY "groups_update_policy" ON public.groups
FOR UPDATE
USING (is_group_admin(auth.uid(), id));

-- Group owners can delete their groups
CREATE POLICY "groups_delete_policy" ON public.groups
FOR DELETE
USING (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- GROUP_MEMBERS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view members of groups they belong to
-- Global admins can view all members
CREATE POLICY "group_members_select_policy" ON public.group_members
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_group_member(auth.uid(), group_id)
  OR is_global_admin(auth.uid())
);

-- Invited users can add themselves when accepting invitations
CREATE POLICY "group_members_insert_policy" ON public.group_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.invitations
    WHERE invitations.group_id = group_members.group_id
    AND invitations.invitee_email = get_current_user_email()
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);

-- Users can remove themselves, or admins can remove others
CREATE POLICY "group_members_delete_policy" ON public.group_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR is_group_admin(auth.uid(), group_id)
);

-- ----------------------------------------------------------------------------
-- USER_ROLES TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view roles in their groups
-- Global admins can view all roles
CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = user_roles.group_id
      AND group_members.user_id = auth.uid()
  )
  OR is_global_admin(auth.uid())
);

-- Group admins can assign roles
-- Global admins can assign any role
CREATE POLICY "user_roles_insert_policy" ON public.user_roles
FOR INSERT
WITH CHECK (
  is_group_admin(auth.uid(), group_id)
  OR is_global_admin(auth.uid())
);

-- Group admins can update roles (but not their own)
-- Global admins can update any role
CREATE POLICY "user_roles_update_policy" ON public.user_roles
FOR UPDATE
USING (
  (is_group_admin(auth.uid(), group_id) AND user_id <> auth.uid())
  OR is_global_admin(auth.uid())
);

-- Group admins can remove roles (but not their own)
-- Global admins can remove any role
CREATE POLICY "user_roles_delete_policy" ON public.user_roles
FOR DELETE
USING (
  (is_group_admin(auth.uid(), group_id) AND user_id <> auth.uid())
  OR is_global_admin(auth.uid())
);

-- ----------------------------------------------------------------------------
-- INVITATIONS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Permissive: Inviters can see their sent invitations
CREATE POLICY "invitations_select_by_inviter" ON public.invitations
FOR SELECT
USING (inviter_id = auth.uid());

-- Permissive: Group admins can see group invitations
CREATE POLICY "invitations_select_by_admin" ON public.invitations
FOR SELECT
USING (is_group_admin(auth.uid(), group_id));

-- Permissive: Invitees can see invitations sent to their email
CREATE POLICY "invitations_select_by_invitee" ON public.invitations
FOR SELECT
USING (invitee_email = get_current_user_email());

-- Restrictive: Must be authenticated to view invitations
CREATE POLICY "invitations_require_auth" ON public.invitations
AS RESTRICTIVE
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Group members can create invitations
CREATE POLICY "invitations_insert_policy" ON public.invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = invitations.group_id
      AND group_members.user_id = auth.uid()
  )
);

-- Inviters, admins, and invitees can update invitations
CREATE POLICY "invitations_update_policy" ON public.invitations
FOR UPDATE
USING (
  inviter_id = auth.uid()
  OR is_group_admin(auth.uid(), group_id)
  OR invitee_email = get_current_user_email()
);

-- Inviters and admins can delete invitations
CREATE POLICY "invitations_delete_policy" ON public.invitations
FOR DELETE
USING (
  inviter_id = auth.uid()
  OR is_group_admin(auth.uid(), group_id)
);

-- ----------------------------------------------------------------------------
-- WISHLISTS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view wishlists in groups they belong to
CREATE POLICY "wishlists_select_policy" ON public.wishlists
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = wishlists.group_id
      AND group_members.user_id = auth.uid()
  )
);

-- Users can create wishlists in their groups
CREATE POLICY "wishlists_insert_policy" ON public.wishlists
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = wishlists.group_id
      AND group_members.user_id = auth.uid()
  )
);

-- Users can update their own wishlists
CREATE POLICY "wishlists_update_policy" ON public.wishlists
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own wishlists
CREATE POLICY "wishlists_delete_policy" ON public.wishlists
FOR DELETE
USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- ITEMS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Users can view items in wishlists from groups they belong to
CREATE POLICY "items_select_policy" ON public.items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wishlists w
    INNER JOIN public.group_members gm ON w.group_id = gm.group_id
    WHERE w.id = items.wishlist_id
      AND gm.user_id = auth.uid()
  )
);

-- Wishlist owners can insert items into their wishlists
CREATE POLICY "items_insert_policy" ON public.items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wishlists
    WHERE wishlists.id = items.wishlist_id
      AND wishlists.user_id = auth.uid()
  )
);

-- Wishlist owners can update their items
CREATE POLICY "items_update_policy" ON public.items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.wishlists
    WHERE wishlists.id = items.wishlist_id
      AND wishlists.user_id = auth.uid()
  )
);

-- Wishlist owners can delete their items
CREATE POLICY "items_delete_policy" ON public.items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.wishlists
    WHERE wishlists.id = items.wishlist_id
      AND wishlists.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- ITEM_CLAIMS TABLE POLICIES
-- ----------------------------------------------------------------------------

-- Claimers can always see their own claims
CREATE POLICY "item_claims_select_own" ON public.item_claims
FOR SELECT
USING (claimer_id = auth.uid());

-- Wishlist owners can see claims after reveal date
CREATE POLICY "item_claims_select_after_reveal" ON public.item_claims
FOR SELECT
USING (
  is_reveal_date_reached(reveal_date)
  AND EXISTS (
    SELECT 1 FROM public.items i
    INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id
      AND w.user_id = auth.uid()
  )
);

-- Group members can see others' claims (but not on their own wishlist before reveal)
CREATE POLICY "item_claims_select_others" ON public.item_claims
FOR SELECT
USING (
  claimer_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = item_claims.group_id
      AND group_members.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.items i
    INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id
      AND w.user_id = auth.uid()
      AND NOT is_reveal_date_reached(item_claims.reveal_date)
  )
);

-- Group members can claim items (but not their own)
CREATE POLICY "item_claims_insert_policy" ON public.item_claims
FOR INSERT
WITH CHECK (
  claimer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = item_claims.group_id
      AND group_members.user_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.items i
    INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id
      AND w.user_id = auth.uid()
  )
);

-- Claimers can update their own claims
CREATE POLICY "item_claims_update_policy" ON public.item_claims
FOR UPDATE
USING (claimer_id = auth.uid());

-- Claimers can delete their own claims
CREATE POLICY "item_claims_delete_policy" ON public.item_claims
FOR DELETE
USING (claimer_id = auth.uid());

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'Consolidated schema for Underwraps Gift List application. Created from 33 incremental migrations.';

