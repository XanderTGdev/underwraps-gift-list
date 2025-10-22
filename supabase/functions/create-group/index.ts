import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateGroupRequest {
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for bypass operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error:", userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Better error handling for body parsing
    let requestBody: CreateGroupRequest;
    try {
      requestBody = await req.json();
      console.log('Parsed request body:', requestBody);
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name } = requestBody;
    console.log('Extracted name:', name, 'Type:', typeof name);

    // Sanitization helper - removes control characters and trims
    const sanitizeString = (str: string): string => {
      return str
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .trim();
    };

    // Validate inputs
    if (!name || typeof name !== 'string') {
      console.error('Validation failed:', { name, type: typeof name });
      return new Response(
        JSON.stringify({ error: 'Name is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize the name
    const sanitizedName = sanitizeString(name);

    if (!sanitizedName || sanitizedName.length === 0) {
      console.error('Name is empty after sanitization');
      return new Response(
        JSON.stringify({ error: 'Name is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sanitizedName.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Name must be less than 200 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the group
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: sanitizedName,
        owner_id: user.id,
      })
      .select()
      .single();

    if (groupError) {
      console.error("Group insert error:", groupError);
      return new Response(
        JSON.stringify({ error: groupError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add the creator as the owner member of the group
    // The handle_new_member trigger will automatically assign the owner role
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
      });

    if (memberError) {
      console.error("Group member insert error:", memberError);
      // Don't fail the request - the group was created successfully
      console.warn("Warning: group created but failed to add owner as member:", memberError);
    }

    // Also add the owner role in user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: user.id,
        group_id: group.id,
        role: 'owner',
      });

    if (roleError) {
      console.error("User role insert error:", roleError);
      // Don't fail the request - the group was created successfully
      console.warn("Warning: group created but failed to add owner role:", roleError);
    }

    console.log("Group created successfully:", group.id);

    return new Response(
      JSON.stringify({ success: true, group }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in create-group function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
