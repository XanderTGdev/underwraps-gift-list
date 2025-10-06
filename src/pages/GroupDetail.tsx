import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Mail, Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import InviteMemberDialog from "@/components/InviteMemberDialog";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Wishlist {
  id: string;
  name: string;
  user_id: string;
  user_name: string;
  item_count?: number;
}

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchGroupData();
  }, [groupId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);
  };

  const fetchGroupData = async () => {
    try {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();

      if (groupError) throw groupError;
      setGroupName(group.name);

      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select(`
          role,
          profiles (
            id,
            name,
            email
          )
        `)
        .eq("group_id", groupId);

      if (membersError) throw membersError;

      const membersList = membersData?.map((m: any) => ({
        id: m.profiles.id,
        name: m.profiles.name,
        email: m.profiles.email,
        role: m.role,
      })) || [];

      setMembers(membersList);

      const { data: wishlistsData, error: wishlistsError } = await supabase
        .from("wishlists")
        .select(`
          id,
          name,
          user_id,
          profiles (
            name
          )
        `)
        .eq("group_id", groupId);

      if (wishlistsError) throw wishlistsError;

      const wishlistsList = wishlistsData?.map((w: any) => ({
        id: w.id,
        name: w.name,
        user_id: w.user_id,
        user_name: w.profiles?.name || "Unknown",
      })) || [];

      setWishlists(wishlistsList);
    } catch (error: any) {
      toast.error("Failed to load group data");
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWishlist = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from("wishlists")
        .insert({
          user_id: currentUserId,
          group_id: groupId,
          name: "My Wishlist",
          is_default: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Wishlist created!");
      navigate(`/wishlists/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create wishlist");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{groupName}</h1>
          <p className="text-gray-600 dark:text-slate-400">
            Manage members and view wishlists
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <CardTitle>Members</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={() => setInviteDialogOpen(true)}
                  className="gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{member.name}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{member.email}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <CardTitle>Wishlists</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateWishlist}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {wishlists.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    No wishlists yet. Create one to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlists.map((wishlist) => (
                    <div
                      key={wishlist.id}
                      className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                      onClick={() => navigate(`/wishlists/${wishlist.id}`)}
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">{wishlist.name}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        by {wishlist.user_id === currentUserId ? "You" : wishlist.user_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <InviteMemberDialog
        groupId={groupId || ""}
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={fetchGroupData}
      />
    </Layout>
  );
};

export default GroupDetail;
