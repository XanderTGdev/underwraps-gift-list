import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface InvitationRequest {
  groupId: string;
  inviteeEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      throw new Error("Missing authorization header");
    }

    const jwtToken = authHeader.replace("Bearer ", "");
    if (!jwtToken || jwtToken === authHeader) {
      console.error("Malformed Authorization header - missing Bearer prefix");
      throw new Error("Invalid authorization header format");
    }

    console.log("Authenticating request with JWT token...");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(jwtToken);

    if (userError || !user) {
      console.error("Authentication failed");
      throw new Error("Unauthorized");
    }

    console.log("Authenticated user:", user.id);

    const { groupId, inviteeEmail }: InvitationRequest = await req.json();

    if (!groupId) {
      throw new Error("Group ID is required");
    }
    if (!inviteeEmail) {
      throw new Error("Email address is required");
    }

    if (typeof groupId !== "string" || typeof inviteeEmail !== "string") {
      throw new Error("Invalid field types");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = inviteeEmail.trim();
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error("Invalid email address");
    }

    if (trimmedEmail.length > 255) {
      throw new Error("Email address must be less than 255 characters");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      throw new Error("Invalid group ID format");
    }

    console.log(`Processing invitation for ${trimmedEmail} to group ${groupId}`);

    const { data: membership, error: membershipError } = await supabaseClient
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      console.error("Membership check failed");
      throw new Error("You are not a member of this group");
    }

    console.log("User membership verified");

    const { data: group, error: groupError } = await supabaseClient
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      console.error("Group lookup failed");
      throw new Error("Group not found");
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log("Generated invitation token, expires:", expiresAt);

    const { data: invitation, error: insertError } = await supabaseClient
      .from("invitations")
      .insert({
        group_id: groupId,
        invitee_email: trimmedEmail,
        inviter_id: user.id,
        token: token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create invitation");
      throw new Error("Failed to create invitation");
    }

    console.log("Invitation created:", invitation.id);

    const appBaseUrl =
      Deno.env.get("APP_BASE_URL") ||
      `https://${Deno.env.get("SUPABASE_URL")?.split("//")[1]?.replace(".supabase.co", ".lovableproject.com")}`;

    const invitationLink = `${appBaseUrl}/accept-invite?token=${token}`;

    console.log("Sending invitation email to:", inviteeEmail);

    const fromEmail = Deno.env.get("FROM_EMAIL") || "Group Invites <onboarding@resend.dev>";

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [trimmedEmail],
      subject: `You've been invited to join ${group.name}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background: #667eea;
                color: white !important;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
                font-weight: bold;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #888;
                font-size: 12px;
              }
              .group-name {
                font-weight: bold;
                color: #667eea;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 You're Invited!</h1>
            </div>
            <div class="content">
              <h2>Join <span class="group-name">${group.name}</span></h2>
              <p>You've been invited to join a wishlist group. Accept this invitation to start sharing wishlists and coordinating gifts with the group!</p>
              
              <p style="text-align: center;">
                <a href="${invitationLink}" class="button">Accept Invitation</a>
              </p>
              
              <p style="color: #666; font-size: 14px;">
                Or copy and paste this link into your browser:<br>
                <code style="background: #f4f4f4; padding: 8px; display: block; margin-top: 8px; word-break: break-all;">${invitationLink}</code>
              </p>
              
              <p style="color: #888; font-size: 13px; margin-top: 30px;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>Sent via Wishlist Groups</p>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Failed to send email");
      throw new Error(`Failed to send invitation email: ${emailError.message}`);
    }

    console.log("Email sent successfully:", emailData);

    return corsResponse(req, {
      success: true,
      message: "Invitation sent successfully",
      invitationId: invitation.id,
    }, 200);
  } catch (error: any) {
    console.error("Error in send-invitation function");

    const userMessage = (() => {
      if (error.message === "Unauthorized" || error.message === "Missing authorization header" || error.message === "Invalid authorization header format") {
        return "Authentication required";
      }
      if (error.message?.includes("not a member")) {
        return "You don't have permission to invite members to this group";
      }
      if (error.message?.includes("Invalid email")) {
        return "Please provide a valid email address";
      }
      if (error.message?.includes("Missing required fields")) {
        return "Please provide all required information";
      }
      if (error.message?.includes("Group not found")) {
        return "Group not found";
      }
      return "Unable to send invitation. Please try again later.";
    })();

    return corsErrorResponse(req, userMessage, error.message === "Unauthorized" ? 401 : 400);
  }
};

serve(handler);
