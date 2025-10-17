import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  created_at: string;
  member_count?: number;
}

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchGroups();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("group_members")
        .select(`
          group_id,
          groups (
            id,
            name,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const groupsData = data
        ?.map((item: any) => item.groups)
        .filter(Boolean) || [];

      setGroups(groupsData);
    } catch (error: any) {
      toast.error("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-group', {
        body: { name: newGroupName },
      });

      if (error) throw error;

      toast.success("Group created!");
      setCreateDialogOpen(false);
      setNewGroupName("");
      fetchGroups();
    } catch (error: any) {
      toast.error(error.message || "Failed to create group");
    } finally {
      setCreating(false);
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Groups</h1>
            <p className="text-muted-foreground">
              Manage your gift groups and wishlists
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>
                    Create a group to share wishlists with friends and family
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      placeholder="Family, Friends, Work..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {groups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Users className="w-10 h-10 text-gray-400 dark:text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">No groups yet</h3>
              <p className="text-gray-600 dark:text-slate-400 text-center mb-6 max-w-md">
                Create your first group to start sharing wishlists with friends and family
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Your First Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="hover:border-teal-500 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => navigate(`/groups/${group.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-teal-600 dark:bg-teal-500 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-900 dark:text-slate-100">{group.name}</CardTitle>
                        <CardDescription>
                          Created {new Date(group.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Groups;
