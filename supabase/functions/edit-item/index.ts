import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EditItemRequest {
  itemId: string;
  title: string;
  url?: string;
  price?: number;
  imageUrl?: string;
  note?: string;
  currency?: string;
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

    const { itemId, title, url, price, imageUrl, note, currency }: EditItemRequest = await req.json();

    // Validate inputs
    if (!itemId || typeof itemId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Item ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Title is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (title.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Title must be less than 500 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (url && typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (url && url.length > 2048) {
      return new Response(
        JSON.stringify({ error: 'URL must be less than 2048 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (price !== undefined && price !== null && (typeof price !== 'number' || price < 0)) {
      return new Response(
        JSON.stringify({ error: 'Price must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageUrl && typeof imageUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Image URL must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageUrl && imageUrl.length > 2048) {
      return new Response(
        JSON.stringify({ error: 'Image URL must be less than 2048 characters' }),
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

    if (currency && typeof currency !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Currency must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the item belongs to the user's wishlist
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('wishlist_id, wishlists!inner(user_id)')
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

    if (wishlist.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only edit your own items' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the item
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update({
        title: title.trim(),
        url: url || null,
        price: price ?? null,
        image_url: imageUrl || null,
        note: note || null,
        currency: currency || 'USD',
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error("Item update error:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Item updated successfully:", updatedItem.id);

    return new Response(
      JSON.stringify({ success: true, item: updatedItem }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in edit-item function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
