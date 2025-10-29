import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface CreateGroupRequest {
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

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
      console.error("Authentication error");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    // Better error handling for body parsing
    let requestBody: CreateGroupRequest;
    try {
      requestBody = await req.json();
      console.log('Parsed request body:', requestBody);
    } catch (parseError) {
      console.error("Error parsing request body");
      return corsErrorResponse(req, 'Invalid JSON in request body', 400);
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
      return corsErrorResponse(req, 'Name is required and must be a non-empty string', 400);
    }

    // Sanitize the name
    const sanitizedName = sanitizeString(name);

    if (!sanitizedName || sanitizedName.length === 0) {
      console.error('Name is empty after sanitization');
      return corsErrorResponse(req, 'Name is required and must be a non-empty string', 400);
    }

    if (sanitizedName.length > 200) {
      return corsErrorResponse(req, 'Name must be less than 200 characters', 400);
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
      console.error("Group insert error:", {
        message: groupError.message,
        code: groupError.code,
        details: groupError.details,
        hint: groupError.hint,
      });
      return corsErrorResponse(req, `Failed to create group: ${groupError.message}`, 400);
    }

    console.log("Group created successfully:", group.id);

    // Add the creator as the owner member of the group
    // The handle_new_member trigger will automatically assign the owner role
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
      });

    if (memberError) {
      console.error("Group member insert error:", {
        message: memberError.message,
        code: memberError.code,
        details: memberError.details,
        hint: memberError.hint,
      });
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
      console.error("User role insert error:", {
        message: roleError.message,
        code: roleError.code,
        details: roleError.details,
        hint: roleError.hint,
      });
    }

    console.log("Group created successfully with membership and roles:", group.id);

    return corsResponse(req, { success: true, group }, 200);
  } catch (error: any) {
    console.error("Error in create-group function");
    return corsErrorResponse(req, 'Failed to create group', 500);
  }
};

serve(handler);
