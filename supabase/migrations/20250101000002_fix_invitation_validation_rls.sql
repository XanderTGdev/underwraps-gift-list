-- Fix invitation validation RLS policy conflict
-- Remove the restrictive policy that blocks unauthenticated access to invitations

-- Drop the restrictive policy that requires authentication
-- This policy was blocking the validate-invitation function from working
DROP POLICY IF EXISTS "invitations_require_auth" ON public.invitations;

-- The permissive policy "invitations_public_by_token" already exists and allows
-- public access to invitations when a token is provided, which is what we need
-- for the invitation validation flow to work properly.
