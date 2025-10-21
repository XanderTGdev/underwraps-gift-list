import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteWishlistRequest {
  wishlistId: string;
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

    const { wishlistId }: DeleteWishlistRequest = await req.json();

    // Validate inputs
    if (!wishlistId || typeof wishlistId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Wishlist ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the wishlist belongs to the user
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('user_id, group_id')
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
        JSON.stringify({ error: 'You can only delete your own wishlist' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the wishlist (cascade will handle items and claims)
    const { error: deleteError } = await supabase
      .from('wishlists')
      .delete()
      .eq('id', wishlistId);

    if (deleteError) {
      console.error("Wishlist delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Wishlist deleted successfully:", wishlistId);

    return new Response(
      JSON.stringify({ success: true, groupId: wishlist.group_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in delete-wishlist function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);

