import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface DeleteUserRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // 1. Authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    if (!authHeader) {
      console.error("Missing Authorization header");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    // Create client with anon key for user verification
    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    // 2. Validation
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId || typeof userId !== 'string') {
      return corsErrorResponse(req, 'User ID is required and must be a string', 400);
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return corsErrorResponse(req, 'Invalid user ID format', 400);
    }

    // 3. Authorization - Must be global admin
    const { data: isGlobalAdmin, error: adminError } = await supabaseAnon
      .rpc('is_global_admin', { _user_id: user.id });

    if (adminError || !isGlobalAdmin) {
      console.error("Authorization check failed");
      return corsErrorResponse(req, 'You must be a global admin to delete users', 403);
    }

    // Prevent self-deletion
    if (user.id === userId) {
      return corsErrorResponse(req, 'You cannot delete your own account', 403);
    }

    // 4. Business Logic - Delete user using service role
    // This will cascade delete related records due to foreign key constraints
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("User deletion error");
      return corsErrorResponse(req, 'Failed to delete user', 400);
    }

    console.log(`User ${userId} deleted successfully by admin ${user.id}`);

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in delete-user function");
    return corsErrorResponse(req, 'Failed to delete user', 500);
  }
};

serve(handler);
