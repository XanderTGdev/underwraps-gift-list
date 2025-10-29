import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface CreateWishlistRequest {
  groupId: string;
  name?: string;
  userFirstName?: string;
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

    const { groupId, name, userFirstName }: CreateWishlistRequest = await req.json();
    console.log('create-wishlist payload:', { groupId, providedName: name, userFirstName });

    // Sanitization helper - removes control characters and trims
    const sanitizeString = (str: string): string => {
      return str
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim();
    };

    // Validate inputs
    if (!groupId || typeof groupId !== 'string') {
      console.log('Group ID is required and must be a string', groupId);
      return corsErrorResponse(req, 'Group ID is required and must be a string', 400);
    }

    if (name !== undefined && typeof name !== 'string') {
      console.log('Name must be a string', name);
      return corsErrorResponse(req, 'Name must be a string', 400);
    }

    if (userFirstName !== undefined && typeof userFirstName !== 'string') {
      console.log('User first name must be a string', userFirstName);
      return corsErrorResponse(req, 'User first name must be a string', 400);
    }

    // Sanitize inputs
    const sanitizedName = name ? sanitizeString(name) : undefined;
    const sanitizedFirstName = userFirstName ? sanitizeString(userFirstName) : undefined;

    if (sanitizedName && sanitizedName.length > 200) {
      console.log('Name must be less than 200 characters', sanitizedName);
      return corsErrorResponse(req, 'Name must be less than 200 characters', 400);
    }

    if (sanitizedFirstName && sanitizedFirstName.length > 100) {
      console.log('First name must be less than 100 characters', sanitizedFirstName);
      return corsErrorResponse(req, 'First name must be less than 100 characters', 400);
    }

    // Verify user is a member of the group
    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check error");
      return corsErrorResponse(req, 'You must be a member of this group to create wishlists', 403);
    }

    // Helper to generate a unique default name like "John's Wishlist", "John's Wishlist 2", "John's Wishlist 3", ...
    const generateNextDefaultName = async (firstName?: string): Promise<string> => {
      let baseName = 'My Wishlist';
      if (firstName && firstName.trim()) {
        baseName = `${firstName.trim()}'s Wishlist`;
      }
      console.log("Base name:", baseName);

      const { data: existingWishlists } = await supabase
        .from('wishlists')
        .select('name')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .like('name', `${baseName}%`);
      console.log('Existing default-like names for user/group:', existingWishlists?.map(w => w.name));

      const usedNumbers = new Set<number>();
      // Escape special regex characters in the baseName (like apostrophes)
      const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${escapedBaseName}(?: (\\d+))?$`);
      (existingWishlists || []).forEach((w) => {
        const match = w.name.match(pattern);
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
    const userProvidedName = sanitizedName && sanitizedName.length > 0;
    let finalName = sanitizedName || '';

    if (userProvidedName) {
      const { data: dupCheck, error: dupCheckError } = await supabase
        .from('wishlists')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('name', finalName)
        .limit(1);

      if (dupCheckError) {
        console.error('Duplicate check error');
        return corsErrorResponse(req, 'Could not verify uniqueness', 400);
      }

      if (dupCheck && dupCheck.length > 0) {
        return corsResponse(req, { error: `You already have a wishlist named "${finalName}" in this group` }, 409);
      }
    } else {
      finalName = await generateNextDefaultName(sanitizedFirstName);
    }
    console.log('Determined finalName:', { finalName, userProvidedName });

    // Insert with retry on unique constraint violations to handle race conditions
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      console.log('Attempting insert', { attempt: attempt + 1, finalName });
      const { data: wishlist, error: insertError, status: insertStatus } = await supabase
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
        return corsResponse(req, { success: true, wishlist }, 200);
      }

      if (insertError) {
        const message = (insertError as any)?.message || '';
        const code = (insertError as any)?.code;
        const isUniqueViolation = insertStatus === 409 || code === '23505' || message.toLowerCase().includes('duplicate key value') || message.toLowerCase().includes('conflict');
        console.warn('Insert attempt failed', { attempt: attempt + 1, finalName, insertStatus, code });

        // If duplicate and the user explicitly chose the name, return 409 immediately
        if (isUniqueViolation && userProvidedName) {
          return corsResponse(req, { error: `You already have a wishlist named "${finalName}" in this group` }, 409);
        }

        // If duplicate while auto-generating, regenerate and retry
        if (isUniqueViolation && !userProvidedName) {
          console.warn(`Unique violation on attempt ${attempt + 1}, regenerating name...`);
          finalName = await generateNextDefaultName(sanitizedFirstName);
          continue;
        }

        console.error('Wishlist insert error');
        return corsErrorResponse(req, 'Failed to create wishlist', 400);
      }
    }

    // If we exhausted retries due to contention
    return corsResponse(req, { error: 'Could not create wishlist due to concurrent requests. Please try again.' }, 409);
  } catch (error: any) {
    console.error("Error in create-wishlist function");
    return corsErrorResponse(req, 'Failed to create wishlist', 500);
  }
};

serve(handler);
