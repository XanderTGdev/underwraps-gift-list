import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateWishlistRequest {
  groupId: string;
  name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { groupId, name }: CreateWishlistRequest = await req.json();

    // Validate inputs
    if (!groupId || typeof groupId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Group ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name && typeof name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Name must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name && name.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Name must be less than 200 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a member of the group
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check error:", membershipError);
      return new Response(
        JSON.stringify({ error: 'You must be a member of this group to create wishlists' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique name if needed
    let finalName = name || 'My Wishlist';

    if (!name || name === 'My Wishlist') {
      // Check if user already has a wishlist with this name
      const { data: existingWishlists } = await supabase
        .from('wishlists')
        .select('name')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .like('name', 'My Wishlist%');

      if (existingWishlists && existingWishlists.length > 0) {
        // Find the next available number
        const numbers = existingWishlists
          .map(w => {
            const match = w.name.match(/^My Wishlist(?: (\d+))?$/);
            return match ? parseInt(match[1] || '0') : 0;
          })
          .sort((a, b) => b - a);

        const nextNumber = numbers[0] + 1;
        finalName = nextNumber === 1 ? 'My Wishlist 2' : `My Wishlist ${nextNumber}`;
      }
    }

    // Create the wishlist
    const { data: wishlist, error: insertError } = await supabase
      .from('wishlists')
      .insert({
        group_id: groupId,
        user_id: user.id,
        name: finalName,
        is_default: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Wishlist insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Wishlist created successfully:", wishlist.id);

    return new Response(
      JSON.stringify({ success: true, wishlist }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in create-wishlist function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
