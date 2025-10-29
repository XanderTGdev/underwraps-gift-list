import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface DeleteWishlistRequest {
  wishlistId: string;
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

    const { wishlistId }: DeleteWishlistRequest = await req.json();

    // Validate inputs
    if (!wishlistId || typeof wishlistId !== 'string') {
      return corsErrorResponse(req, 'Wishlist ID is required and must be a string', 400);
    }

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('user_id, group_id')
      .eq('id', wishlistId)
      .single();

    if (wishlistError || !wishlist) {
      console.error("Wishlist fetch error");
      return corsErrorResponse(req, 'Wishlist not found', 404);
    }

    if (wishlist.user_id !== user.id) {
      return corsErrorResponse(req, 'You can only delete your own wishlist', 403);
    }

    // Delete the wishlist (cascade will handle items and claims)
    const { error: deleteError } = await supabase
      .from('wishlists')
      .delete()
      .eq('id', wishlistId);

    if (deleteError) {
      console.error("Wishlist delete error");
      return corsErrorResponse(req, 'Failed to delete wishlist', 400);
    }

    console.log("Wishlist deleted successfully:", wishlistId);

    return corsResponse(req, { success: true, groupId: wishlist.group_id }, 200);
  } catch (error: any) {
    console.error("Error in delete-wishlist function");
    return corsErrorResponse(req, 'Failed to delete wishlist', 500);
  }
};

serve(handler);
