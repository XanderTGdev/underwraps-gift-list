import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { token }: ValidationRequest = await req.json();

    // Validate required fields
    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invitation token is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Validate token is a string
    if (typeof token !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid token format",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Validate token length and format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token.trim())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid invitation token",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log("Validating invitation token");

    // Create Supabase client with service role key to bypass RLS
    // This allows the function to read invitations without authentication
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Query invitation with service role (bypasses RLS)
    // Use maybeSingle() to avoid errors when no match is found
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .select("id, group_id, invitee_email, status, expires_at")
      .eq("token", token.trim())
      .maybeSingle();

    if (invitationError || !invitation) {
      console.log("Invitation not found or error:", invitationError);
      return new Response(
        JSON.stringify({
          success: false,
          status: "invalid",
          error: "Invalid invitation",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Get group name separately to avoid RLS issues with joins
    const { data: group, error: groupError } = await supabaseAdmin
      .from("groups")
      .select("name")
      .eq("id", invitation.group_id)
      .single();

    const groupName = group?.name || "Unknown Group";

    // Check if invitation is expired
    const isExpired = new Date(invitation.expires_at) < new Date();

    // Check if invitation is valid
    const isValid = invitation.status === "pending" && !isExpired;

    console.log("Invitation validation result:", {
      invitationId: invitation.id,
      status: invitation.status,
      isExpired,
      isValid,
    });

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    // Log detailed error server-side for debugging
    console.error("Error in validate-invitation function:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to validate invitation. Please try again later.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
