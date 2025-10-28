import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptInvitationRequest {
  invitationId: string;
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

    const { invitationId }: AcceptInvitationRequest = await req.json();

    // Validate inputs
    if (!invitationId || typeof invitationId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invitation ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('id, group_id, invitee_email, status, expires_at')
      .eq('id', invitationId)
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation fetch error:", invitationError);
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the invitation is for the current user
    if (user.email !== invitation.invitee_email) {
      return new Response(
        JSON.stringify({ error: 'This invitation is for a different email address. Please log in with the correct account.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: 'Invitation already accepted', alreadyAccepted: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

      return new Response(
        JSON.stringify({ success: true, groupId: invitation.group_id, alreadyMember: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add user to group
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: invitation.group_id,
        user_id: user.id,
      });

    if (memberError) {
      console.error("Group member insert error:", memberError);
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure user has a role entry (use upsert to handle existing entries safely)
    const { error: roleError } = await supabase.rpc('upsert_user_role_safe', {
      p_group_id: invitation.group_id,
      p_user_id: user.id,
      p_role: 'member'
    });

    if (roleError) {
      console.error("User role upsert error:", roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign user role. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    if (updateError) {
      console.error("Update invitation error:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Invitation accepted successfully:", invitationId);

    return new Response(
      JSON.stringify({ success: true, groupId: invitation.group_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in accept-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
