import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface DeleteItemRequest {
  itemId: string;
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

    const { itemId }: DeleteItemRequest = await req.json();

    // Validate inputs
    if (!itemId || typeof itemId !== 'string') {
      return corsErrorResponse(req, 'Item ID is required and must be a string', 400);
    }

    // Verify the item belongs to the user's wishlist
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('wishlist_id, wishlists!inner(user_id)')
      .eq('id', itemId)
      .single();

    if (itemError || !item || !item.wishlists) {
      console.error("Item fetch error");
      return corsErrorResponse(req, 'Item not found', 404);
    }

    const wishlist = Array.isArray(item.wishlists) ? item.wishlists[0] : item.wishlists;

    if (wishlist.user_id !== user.id) {
      return corsErrorResponse(req, 'You can only delete your own items', 403);
    }

    // Delete the item
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error("Item delete error");
      return corsErrorResponse(req, 'Failed to delete item', 400);
    }

    console.log("Item deleted successfully:", itemId);

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in delete-item function");
    return corsErrorResponse(req, 'Failed to delete item', 500);
  }
};

serve(handler);
