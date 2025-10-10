-- Comprehensive fix for invitation acceptance
-- This migration ensures ONLY the invitation-based policy exists

-- Step 1: Drop ALL existing INSERT policies on group_members (with all possible names)
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'group_members' 
        AND schemaname = 'public'
        AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_members', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Step 2: Ensure helper function exists
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Step 3: Create ONLY ONE INSERT policy - the invitation-based one
CREATE POLICY "Invited users can add themselves when accepting invitations"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only add themselves
  user_id = auth.uid()
  AND
  -- Must have a valid pending invitation for this group
  EXISTS (
    SELECT 1 FROM public.invitations
    WHERE invitations.group_id = group_members.group_id
    AND invitations.invitee_email = public.get_current_user_email()
    AND invitations.status = 'pending'
    AND invitations.expires_at > now()
  )
);

-- Step 4: Verify the policy was created
DO $$
DECLARE
    policy_count int;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'group_members' 
    AND schemaname = 'public'
    AND cmd = 'INSERT';
    
    RAISE NOTICE 'Number of INSERT policies on group_members: %', policy_count;
    
    IF policy_count != 1 THEN
        RAISE WARNING 'Expected exactly 1 INSERT policy, but found %', policy_count;
    ELSE
        RAISE NOTICE 'Success! Exactly 1 INSERT policy exists.';
    END IF;
END $$;

