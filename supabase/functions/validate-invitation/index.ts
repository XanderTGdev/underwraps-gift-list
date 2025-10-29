import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface ValidationRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { token }: ValidationRequest = await req.json();

    if (!token) {
      return corsResponse(req, {
        success: false,
        error: "Invitation token is required",
      }, 400);
    }

    if (typeof token !== "string") {
      return corsResponse(req, {
        success: false,
        error: "Invalid token format",
      }, 400);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token.trim())) {
      return corsResponse(req, {
        success: false,
        error: "Invalid invitation token",
      }, 400);
    }

    console.log("Validating invitation token");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("id, group_id, status, expires_at")
      .eq("token", token.trim())
      .maybeSingle();

    if (invitationError || !invitation) {
      console.log("Invitation not found");
      return corsResponse(req, {
        success: false,
        status: "invalid",
        error: "Invalid invitation",
      }, 404);
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from("groups")
      .select("name")
      .eq("id", invitation.group_id)
      .single();

    const groupName = group?.name || "Unknown Group";
    const isExpired = new Date(invitation.expires_at) < new Date();
    const isValid = invitation.status === "pending" && !isExpired;

    console.log("Invitation validation result:", {
      invitationId: invitation.id,
      status: invitation.status,
      isExpired,
      isValid,
    });

    return corsResponse(req, {
      success: true,
      invitation: {
        id: invitation.id,
        groupId: invitation.group_id,
        groupName: groupName,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        isValid,
        isExpired: invitation.status === "pending" && isExpired ? true : false,
      },
    }, 200);
  } catch (error: any) {
    console.error("Error in validate-invitation function");
    return corsErrorResponse(req, "Unable to validate invitation. Please try again later.", 500);
  }
};

serve(handler);
