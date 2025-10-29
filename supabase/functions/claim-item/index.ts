import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface ClaimItemRequest {
  itemId: string;
  groupId: string;
  revealDate: string;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    const { itemId, groupId, revealDate, note }: ClaimItemRequest = await req.json();

    // Validate inputs
    if (!itemId || typeof itemId !== 'string') {
      return corsErrorResponse(req, 'Item ID is required and must be a string', 400);
    }

    if (!groupId || typeof groupId !== 'string') {
      return corsErrorResponse(req, 'Group ID is required and must be a string', 400);
    }

    if (!revealDate || typeof revealDate !== 'string') {
      return corsErrorResponse(req, 'Reveal date is required and must be a string', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(revealDate)) {
      return corsErrorResponse(req, 'Invalid date format. Use YYYY-MM-DD', 400);
    }

    if (note && typeof note !== 'string') {
      return corsErrorResponse(req, 'Note must be a string', 400);
    }

    if (note && note.length > 1000) {
      return corsErrorResponse(req, 'Note must be less than 1000 characters', 400);
    }

    // Check if user is a member of the group
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check error");
      return corsErrorResponse(req, 'You must be a member of this group to claim items', 403);
    }

    // Check if the item belongs to a wishlist in this group
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('wishlist_id, wishlists!inner(user_id, group_id)')
      .eq('id', itemId)
      .single();

    if (itemError || !item || !item.wishlists) {
      console.error("Item fetch error");
      return corsErrorResponse(req, 'Item not found', 404);
    }

    const wishlist = Array.isArray(item.wishlists) ? item.wishlists[0] : item.wishlists;

    // Prevent claiming own items
    if (wishlist.user_id === user.id) {
      return corsErrorResponse(req, 'You cannot claim your own wishlist items', 403);
    }

    // Verify item belongs to the specified group
    if (wishlist.group_id !== groupId) {
      return corsErrorResponse(req, 'Item does not belong to this group', 403);
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
      console.error("Claim insert error");
      return corsErrorResponse(req, 'Failed to claim item', 400);
    }

    console.log("Item claimed successfully:", claim.id);

    return corsResponse(req, { success: true, claimId: claim.id }, 200);
  } catch (error: any) {
    console.error("Error in claim-item function");
    return corsErrorResponse(req, 'Failed to claim item', 500);
  }
};

serve(handler);
