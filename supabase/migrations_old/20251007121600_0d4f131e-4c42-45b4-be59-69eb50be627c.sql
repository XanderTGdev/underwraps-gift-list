-- Make url column nullable in items table
ALTER TABLE public.items 
ALTER COLUMN url DROP NOT NULL;