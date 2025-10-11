-- Reset RLS policies on invitations and group_members to a minimal, correct set

-- Ensure helper exists
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Drop ALL existing policies on invitations
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.invitations', pol.policyname);
    RAISE NOTICE 'Dropped invitations policy: %', pol.policyname;
  END LOOP;
END $$;

-- Recreate invitations policies
-- Restrictive guard: must be authenticated
CREATE POLICY "Require authentication for invitation access"
ON public.invitations
AS RESTRICTIVE
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Permissive: admins, inviter, or the invitee (by email from auth.users)
CREATE POLICY "Only admins, inviters, and invitees can view invitations"
ON public.invitations
FOR SELECT
USING (
  is_group_admin(auth.uid(), group_id)
  OR inviter_id = auth.uid()
  OR invitee_email = public.get_current_user_email()
);

-- Drop ALL existing INSERT policies on group_members
DO $$
DECLARE
  pol2 record;
BEGIN
  FOR pol2 IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'group_members' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_members', pol2.policyname);
    RAISE NOTICE 'Dropped group_members INSERT policy: %', pol2.policyname;
  END LOOP;
END $$;

-- Allow invited users to add themselves when accepting invitations
CREATE POLICY "Invited users can add themselves when accepting invitations"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.group_id = group_members.group_id
      AND i.invitee_email = public.get_current_user_email()
      AND i.status = 'pending'
      AND i.expires_at > now()
  )
);

-- Optional: keep existing SELECT/DELETE policies intact; we only care about INSERT here


