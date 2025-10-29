import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface AddItemRequest {
  wishlistId: string;
  title: string;
  url?: string;
  price?: number;
  imageUrl?: string;
  note?: string;
  currency?: string;
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

    const { wishlistId, title, url, price, imageUrl, note, currency }: AddItemRequest = await req.json();

    // Validate inputs
    if (!wishlistId || typeof wishlistId !== 'string') {
      return corsErrorResponse(req, 'Wishlist ID is required and must be a string', 400);
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return corsErrorResponse(req, 'Title is required and must be a non-empty string', 400);
    }

    if (title.length > 500) {
      return corsErrorResponse(req, 'Title must be less than 500 characters', 400);
    }

    if (url && typeof url !== 'string') {
      return corsErrorResponse(req, 'URL must be a string', 400);
    }

    if (url && url.length > 2048) {
      return corsErrorResponse(req, 'URL must be less than 2048 characters', 400);
    }

    if (price !== undefined && price !== null && (typeof price !== 'number' || price < 0)) {
      return corsErrorResponse(req, 'Price must be a positive number', 400);
    }

    if (imageUrl && typeof imageUrl !== 'string') {
      return corsErrorResponse(req, 'Image URL must be a string', 400);
    }

    if (imageUrl && imageUrl.length > 2048) {
      return corsErrorResponse(req, 'Image URL must be less than 2048 characters', 400);
    }

    if (note && typeof note !== 'string') {
      return corsErrorResponse(req, 'Note must be a string', 400);
    }

    if (note && note.length > 1000) {
      return corsErrorResponse(req, 'Note must be less than 1000 characters', 400);
    }

    if (currency && typeof currency !== 'string') {
      return corsErrorResponse(req, 'Currency must be a string', 400);
    }

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('user_id')
      .eq('id', wishlistId)
      .single();

    if (wishlistError || !wishlist) {
      console.error("Wishlist fetch error");
      return corsErrorResponse(req, 'Wishlist not found', 404);
    }

    if (wishlist.user_id !== user.id) {
      return corsErrorResponse(req, 'You can only add items to your own wishlist', 403);
    }

    // Create the item
    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert({
        wishlist_id: wishlistId,
        title: title.trim(),
        url: url || null,
        price: price ?? null,
        image_url: imageUrl || null,
        note: note || null,
        currency: currency || 'USD',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Item insert error");
      return corsErrorResponse(req, 'Failed to create item', 400);
    }

    console.log("Item created successfully:", newItem.id);

    return corsResponse(req, { success: true, item: newItem }, 200);
  } catch (error: any) {
    console.error("Error in add-item function");
    return corsErrorResponse(req, 'Failed to add item', 500);
  }
};

serve(handler);
