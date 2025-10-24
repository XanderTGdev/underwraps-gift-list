-- Remove the overly permissive authentication-only policy
-- The "Users can view group member profiles" policy already provides
-- secure, granular access control based on group membership
DROP POLICY IF EXISTS "Require authentication for profile access" ON profiles;

-- Keep only the granular policy that restricts profile viewing to:
-- 1. Users viewing their own profile
-- 2. Group admins viewing member profiles  
-- 3. Users who share a group with each other
-- This policy already implicitly requires authentication via auth.uid()

-- Note: The existing "Users can view group member profiles" policy remains active
-- and provides the correct level of security