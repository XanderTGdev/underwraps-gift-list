-- Step 1: Create all tables first
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Now add foreign key constraint for groups.owner_id
ALTER TABLE public.groups ADD CONSTRAINT groups_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

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

CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'My Wishlist',
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, group_id, name)
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid REFERENCES public.wishlists(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  title text,
  price numeric(12,2),
  currency text DEFAULT 'USD',
  image_url text,
  note text,
  quantity int DEFAULT 1 NOT NULL,
  allow_multiple_claims boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.item_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  claimer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  note text,
  reveal_date date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(item_id, claimer_id)
);

-- Step 2: Create indexes
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX idx_wishlists_group ON public.wishlists(group_id);
CREATE INDEX idx_items_wishlist ON public.items(wishlist_id);
CREATE INDEX idx_items_created ON public.items(created_at DESC);
CREATE INDEX idx_claims_item ON public.item_claims(item_id);
CREATE INDEX idx_claims_group ON public.item_claims(group_id);
CREATE INDEX idx_claims_reveal ON public.item_claims(reveal_date);

-- Step 3: Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_claims ENABLE ROW LEVEL SECURITY;

-- Step 4: Add RLS policies (now all tables exist)
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view groups they belong to" ON public.groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

CREATE POLICY "Group owners and admins can update groups" ON public.groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = groups.id AND group_members.user_id = auth.uid() AND group_members.role IN ('owner', 'admin')
  ));

CREATE POLICY "Group owners can delete groups" ON public.groups FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view members of groups they belong to" ON public.group_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Group owners and admins can add members" ON public.group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_members.group_id AND group_members.user_id = auth.uid() AND group_members.role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can remove themselves or admins can remove others" ON public.group_members FOR DELETE
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view invitations for their groups" ON public.invitations FOR SELECT
  USING (invitee_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Group members can create invitations" ON public.invitations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Inviters and admins can update invitations" ON public.invitations FOR UPDATE
  USING (inviter_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = invitations.group_id AND group_members.user_id = auth.uid() AND group_members.role IN ('owner', 'admin')
  ));

CREATE POLICY "Users can view wishlists in their groups" ON public.wishlists FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = wishlists.group_id AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can create wishlists in their groups" ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = wishlists.group_id AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own wishlists" ON public.wishlists FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own wishlists" ON public.wishlists FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view items in wishlists from their groups" ON public.items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.wishlists w
    INNER JOIN public.group_members gm ON w.group_id = gm.group_id
    WHERE w.id = items.wishlist_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Wishlist owners can insert items" ON public.items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wishlists WHERE wishlists.id = items.wishlist_id AND wishlists.user_id = auth.uid()
  ));

CREATE POLICY "Wishlist owners can update items" ON public.items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.wishlists WHERE wishlists.id = items.wishlist_id AND wishlists.user_id = auth.uid()
  ));

CREATE POLICY "Wishlist owners can delete items" ON public.items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.wishlists WHERE wishlists.id = items.wishlist_id AND wishlists.user_id = auth.uid()
  ));

CREATE POLICY "Claimers can always see their claims" ON public.item_claims FOR SELECT USING (claimer_id = auth.uid());

CREATE POLICY "Wishlist owners can see claims after reveal date" ON public.item_claims FOR SELECT
  USING (CURRENT_DATE >= reveal_date AND EXISTS (
    SELECT 1 FROM public.items i INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Group members can see others claims" ON public.item_claims FOR SELECT
  USING (claimer_id != auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = item_claims.group_id AND group_members.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.items i INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id AND w.user_id = auth.uid() AND CURRENT_DATE < item_claims.reveal_date
  ));

CREATE POLICY "Group members can claim items" ON public.item_claims FOR INSERT
  WITH CHECK (claimer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_members WHERE group_members.group_id = item_claims.group_id AND group_members.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.items i INNER JOIN public.wishlists w ON i.wishlist_id = w.id
    WHERE i.id = item_claims.item_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Claimers can update their own claims" ON public.item_claims FOR UPDATE USING (claimer_id = auth.uid());
CREATE POLICY "Claimers can delete their own claims" ON public.item_claims FOR DELETE USING (claimer_id = auth.uid());

-- Step 5: Create trigger function and trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();