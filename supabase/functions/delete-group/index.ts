import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface DeleteGroupRequest {
  groupId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    // 1. Authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    if (!authHeader) {
      console.error("Missing Authorization header");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Authentication error");
      return corsErrorResponse(req, 'Unauthorized', 401);
    }

    // 2. Validation
    const { groupId }: DeleteGroupRequest = await req.json();

    if (!groupId || typeof groupId !== 'string') {
      return corsErrorResponse(req, 'Group ID is required and must be a string', 400);
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      return corsErrorResponse(req, 'Invalid group ID format', 400);
    }

    // 3. Authorization - Check if user is owner or admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      console.error("User role fetch error");
      return corsErrorResponse(req, 'You are not a member of this group', 403);
    }

    const isOwnerOrAdmin = userRole.role === 'owner' || userRole.role === 'admin';

    if (!isOwnerOrAdmin) {
      return corsErrorResponse(req, 'Only group owners and admins can delete the group', 403);
    }

    // 4. Business Logic - Delete the group (cascade will handle all related data)
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      console.error("Group delete error");
      return corsErrorResponse(req, 'Failed to delete group', 400);
    }

    console.log("Group deleted successfully:", groupId);

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in delete-group function");
    return corsErrorResponse(req, 'Failed to delete group', 500);
  }
};

serve(handler);
