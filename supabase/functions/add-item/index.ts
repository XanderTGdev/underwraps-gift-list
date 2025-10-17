import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { wishlistId, title, url, price, imageUrl, note, currency }: AddItemRequest = await req.json();

    // Validate inputs
    if (!wishlistId || typeof wishlistId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Wishlist ID is required and must be a string' }),
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

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('user_id')
      .eq('id', wishlistId)
      .single();

    if (wishlistError || !wishlist) {
      console.error("Wishlist fetch error:", wishlistError);
      return new Response(
        JSON.stringify({ error: 'Wishlist not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (wishlist.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only add items to your own wishlist' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      console.error("Item insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Item created successfully:", newItem.id);

    return new Response(
      JSON.stringify({ success: true, item: newItem }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in add-item function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
