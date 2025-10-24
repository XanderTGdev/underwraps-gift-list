-- Remove the profiles_with_email view as it bypasses RLS
-- Email masking will be handled at the application level instead
DROP VIEW IF EXISTS public.profiles_with_email;