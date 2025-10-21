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
      console.log('Group ID is required and must be a string', groupId);
      return new Response(
        JSON.stringify({ error: 'Group ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name && typeof name !== 'string') {
      console.log('Name must be a string', name);
      return new Response(
        JSON.stringify({ error: 'Name must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name && name.length > 200) {
      console.log('Name must be less than 200 characters', name);
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

    // Helper to generate a unique default name like "My Wishlist", "My Wishlist 2", "My Wishlist 3", ...
    const generateNextDefaultName = async (): Promise<string> => {
      const baseName = 'My Wishlist';

      const { data: existingWishlists } = await supabase
        .from('wishlists')
        .select('name')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .like('name', `${baseName}%`);

      const usedNumbers = new Set<number>();
      (existingWishlists || []).forEach((w) => {
        const match = w.name.match(/^My Wishlist(?: (\d+))?$/);
        if (match) {
          const num = match[1] ? parseInt(match[1], 10) : 0; // 0 represents the base name without a number
          if (!Number.isNaN(num)) usedNumbers.add(num);
        }
      });

      // If base name not used, return it. Otherwise, find the smallest available suffix starting at 2
      if (!usedNumbers.has(0)) return baseName;
      let suffix = 2;
      while (usedNumbers.has(suffix)) suffix += 1;
      return `${baseName} ${suffix}`;
    };

    // Determine final name and handle duplicates
    const trimmedName = (name ?? '').trim();
    const userProvidedName = trimmedName.length > 0;
    let finalName = userProvidedName ? trimmedName : 'My Wishlist';

    if (userProvidedName) {
      const { data: dupCheck, error: dupCheckError } = await supabase
        .from('wishlists')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('name', finalName)
        .limit(1);

      if (dupCheckError) {
        console.error('Duplicate check error:', dupCheckError);
        return new Response(
          JSON.stringify({ error: 'Could not verify uniqueness' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (dupCheck && dupCheck.length > 0) {
        return new Response(
          JSON.stringify({ error: `You already have a wishlist named "${finalName}" in this group` }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      finalName = await generateNextDefaultName();
    }

    // Insert with retry on unique constraint violations to handle race conditions
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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

      if (!insertError && wishlist) {
        console.log('Wishlist created successfully:', wishlist.id);
        return new Response(
          JSON.stringify({ success: true, wishlist }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (insertError) {
        const message = (insertError as any)?.message || '';
        const code = (insertError as any)?.code;
        const isUniqueViolation = code === '23505' || message.toLowerCase().includes('duplicate key value');

        // If duplicate and the user explicitly chose the name, return 409 immediately
        if (isUniqueViolation && userProvidedName) {
          return new Response(
            JSON.stringify({ error: `You already have a wishlist named "${finalName}" in this group` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If duplicate while auto-generating, regenerate and retry
        if (isUniqueViolation && !userProvidedName) {
          console.warn(`Unique violation on attempt ${attempt + 1}, regenerating name...`);
          finalName = await generateNextDefaultName();
          continue;
        }

        console.error('Wishlist insert error:', insertError);
        return new Response(
          JSON.stringify({ error: message || 'Failed to create wishlist' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If we exhausted retries due to contention
    return new Response(
      JSON.stringify({ error: 'Could not create wishlist due to concurrent requests. Please try again.' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
