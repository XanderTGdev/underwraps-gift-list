import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

interface UnclaimItemRequest {
  claimId: string;
}

const handler = async (req: Request): Promise<Response> => {
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

    const { claimId }: UnclaimItemRequest = await req.json();

    // Validate inputs
    if (!claimId || typeof claimId !== 'string') {
      return corsErrorResponse(req, 'Claim ID is required and must be a string', 400);
    }

    // Verify the claim belongs to the user
    const { data: claim, error: claimError } = await supabase
      .from('item_claims')
      .select('id, claimer_id')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      console.error("Claim fetch error");
      return corsErrorResponse(req, 'Claim not found', 404);
    }

    if (claim.claimer_id !== user.id) {
      return corsErrorResponse(req, 'You can only unclaim your own items', 403);
    }

    // Delete the claim
    const { error: deleteError } = await supabase
      .from('item_claims')
      .delete()
      .eq('id', claimId);

    if (deleteError) {
      console.error("Claim delete error");
      return corsErrorResponse(req, 'Failed to unclaim item', 400);
    }

    console.log("Item unclaimed successfully:", claimId);

    return corsResponse(req, { success: true }, 200);
  } catch (error: any) {
    console.error("Error in unclaim-item function");
    return corsErrorResponse(req, 'Failed to unclaim item', 500);
  }
};

serve(handler);
