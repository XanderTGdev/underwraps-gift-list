import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateRoleRequest {
  userId: string;
  groupId: string | null; // null for global roles
  role: 'owner' | 'admin' | 'member' | null; // null to remove role
}

const VALID_ROLES = ['owner', 'admin', 'member'] as const;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // 2. Validation
    const { userId, groupId, role }: UpdateRoleRequest = await req.json();

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'User ID is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (groupId !== null && typeof groupId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Group ID must be a string or null' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (role !== null && !VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Role must be one of: owner, admin, member, or null' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((groupId && !uuidRegex.test(groupId)) || !uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Authorization - Check if current user is admin or global admin
    const { data: isGlobalAdmin, error: globalAdminError } = await supabase
      .rpc('is_global_admin', { _user_id: user.id });

    let isAdmin = false;
    if (groupId) {
      const { data: groupAdmin, error: adminError } = await supabase
        .rpc('is_group_admin', { _user_id: user.id, _group_id: groupId });
      isAdmin = groupAdmin || false;
    }

    if (!isGlobalAdmin && !isAdmin) {
      console.error("Authorization check failed");
      return new Response(
        JSON.stringify({ error: 'You must be an admin to update user roles' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent users from changing their own role (unless global admin)
    if (user.id === userId && !isGlobalAdmin) {
      return new Response(
        JSON.stringify({ error: 'You cannot change your own role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent changing the group owner's role (unless global admin and group-specific)
    if (groupId) {
      const { data: group } = await supabase
        .from('groups')
        .select('owner_id')
        .eq('id', groupId)
        .single();

      if (group && group.owner_id === userId && !isGlobalAdmin) {
        return new Response(
          JSON.stringify({ error: 'Cannot change the group owner\'s role' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Business Logic - Update or delete role
    if (role === null) {
      // Remove the role
      const deleteQuery = supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (groupId === null) {
        deleteQuery.is('group_id', null);
      } else {
        deleteQuery.eq('group_id', groupId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.error("Role deletion error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Removed role for user ${userId} in ${groupId ? `group ${groupId}` : 'global scope'}`);
    } else {
      // Update or insert role
      const { error: upsertError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          group_id: groupId,
          role 
        }, {
          onConflict: 'user_id,group_id'
        });

      if (upsertError) {
        console.error("Role upsert error:", upsertError);
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Updated role for user ${userId} in ${groupId ? `group ${groupId}` : 'global scope'} to ${role}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error in update-user-role function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
