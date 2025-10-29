import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface AcceptInvitationRequest {
  invitationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
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

    const { invitationId }: AcceptInvitationRequest = await req.json();

    // Validate inputs
    if (!invitationId || typeof invitationId !== 'string') {
      return corsErrorResponse(req, 'Invitation ID is required and must be a string', 400);
    }

    // Fetch the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('id, group_id, invitee_email, status, expires_at')
      .eq('id', invitationId)
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation fetch error");
      return corsErrorResponse(req, 'Invitation not found', 404);
    }

    // Verify the invitation is for the current user
    if (user.email !== invitation.invitee_email) {
      return corsErrorResponse(req, 'This invitation is for a different email address. Please log in with the correct account.', 403);
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      return corsResponse(req, { error: 'Invitation already accepted', alreadyAccepted: true }, 400);
    }

    // Check if expired
    if (new Date(invitation.expires_at) <= new Date()) {
      return corsErrorResponse(req, 'Invitation has expired', 400);
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', invitation.group_id)
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
      // Update invitation status even if already a member
      await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      return corsResponse(req, { success: true, groupId: invitation.group_id, alreadyMember: true }, 200);
    }

    // Add user to group
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: invitation.group_id,
        user_id: user.id,
      });

    if (memberError) {
      console.error("Group member insert error");
      return corsErrorResponse(req, 'Failed to add member to group', 400);
    }

    // Ensure user has a role entry (use upsert to handle existing entries safely)
    const { error: roleError } = await supabase.rpc('upsert_user_role_safe', {
      p_group_id: invitation.group_id,
      p_user_id: user.id,
      p_role: 'member'
    });

    if (roleError) {
      console.error("User role upsert error");
      return corsErrorResponse(req, 'Failed to assign user role. Please contact support.', 500);
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    if (updateError) {
      console.error("Update invitation error");
      return corsErrorResponse(req, 'Failed to update invitation status', 400);
    }

    console.log("Invitation accepted successfully:", invitationId);

    return corsResponse(req, { success: true, groupId: invitation.group_id }, 200);
  } catch (error: any) {
    console.error("Error in accept-invitation function");
    return corsErrorResponse(req, 'Failed to accept invitation', 500);
  }
};

serve(handler);
