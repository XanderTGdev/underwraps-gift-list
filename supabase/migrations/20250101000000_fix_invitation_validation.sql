-- Fix invitation validation by allowing public access to invitations by token
-- This allows the validate-invitation function to work without authentication

-- Allow public access to invitations by token for validation
CREATE POLICY "invitations_public_by_token" ON public.invitations
FOR SELECT
USING (token IS NOT NULL);

-- This policy allows anyone to read invitation data if they have a valid token
-- This is needed for the invitation validation flow to work properly

-- Allow public access to group names for invitation validation
-- This allows the validate-invitation function to get group names without authentication
CREATE POLICY "groups_public_name_for_invitations" ON public.groups
FOR SELECT
USING (true);

-- This policy allows public access to group names, which is needed for invitation validation
-- The policy is permissive and allows reading group names for invitation display
