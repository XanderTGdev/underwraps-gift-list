-- Fix security definer view issue by setting security_invoker=on
DROP VIEW IF EXISTS public.profiles_with_email;

CREATE VIEW public.profiles_with_email
WITH (security_invoker=on)
AS
SELECT 
  id,
  created_at,
  CASE 
    WHEN can_view_email(auth.uid(), id) THEN email
    ELSE substring(email from 1 for 1) || '***@' || split_part(email, '@', 2)
  END as email,
  name,
  avatar_url
FROM public.profiles;