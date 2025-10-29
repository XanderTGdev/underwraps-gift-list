import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface RemoveMemberRequest {
  groupId: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
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

    const { groupId, userId }: RemoveMemberRequest = await req.json();

    if (!groupId || typeof groupId !== 'string') {
      return corsErrorResponse(req, 'Group ID is required and must be a string', 400);
    }

    if (!userId || typeof userId !== 'string') {
      return corsErrorResponse(req, 'User ID is required and must be a string', 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      return corsErrorResponse(req, 'Invalid group ID format', 400);
    }

    if (!uuidRegex.test(userId)) {
      return corsErrorResponse(req, 'Invalid user ID format', 400);
    }

    const isSelfRemoval = user.id === userId;

    if (!isSelfRemoval) {
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('is_group_admin', { _user_id: user.id, _group_id: groupId });

      if (adminError || !isAdmin) {
        console.error("Authorization check failed");
        return corsErrorResponse(req, 'You must be a group admin to remove members', 403);
      }

      const { data: group } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (group && group.owner_id === userId) {
        return corsErrorResponse(req, 'Cannot remove the group owner', 403);
      }
    }

    const { error: removeError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (removeError) {
      console.error("Member removal error");
      return corsErrorResponse(req, 'Failed to remove member', 400);
    }

    console.log(`Member ${userId} removed from group ${groupId}`);

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in remove-member function");
    return corsErrorResponse(req, 'Failed to remove member', 500);
  }
};

serve(handler);
