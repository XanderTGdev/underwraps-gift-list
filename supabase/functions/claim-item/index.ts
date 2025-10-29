import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimItemRequest {
  itemId: string;
  groupId: string;
  revealDate: string;
  note?: string;
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

    const { itemId, groupId, revealDate, note }: ClaimItemRequest = await req.json();

    // Validate inputs
    if (!itemId || typeof itemId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Item ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!groupId || typeof groupId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Group ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!revealDate || typeof revealDate !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Reveal date is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(revealDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (note && typeof note !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Note must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (note && note.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Note must be less than 1000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a member of the group
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check error:", membershipError);
      return new Response(
        JSON.stringify({ error: 'You must be a member of this group to claim items' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the item belongs to a wishlist in this group
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('wishlist_id, wishlists!inner(user_id, group_id)')
      .eq('id', itemId)
      .single();

    if (itemError || !item || !item.wishlists) {
      console.error("Item fetch error:", itemError);
      return new Response(
        JSON.stringify({ error: 'Item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wishlist = Array.isArray(item.wishlists) ? item.wishlists[0] : item.wishlists;

    // Prevent claiming own items
    if (wishlist.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot claim your own wishlist items' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify item belongs to the specified group
    if (wishlist.group_id !== groupId) {
      return new Response(
        JSON.stringify({ error: 'Item does not belong to this group' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the claim
    const { data: claim, error: claimError } = await supabase
      .from('item_claims')
      .insert({
        item_id: itemId,
        claimer_id: user.id,
        group_id: groupId,
        reveal_date: revealDate,
        note: note || null,
      })
      .select()
      .single();

    if (claimError) {
      console.error("Claim insert error:", claimError);
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Item claimed successfully:", claim.id);

    return new Response(
      JSON.stringify({ success: true, claimId: claim.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in claim-item function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
