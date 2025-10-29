import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUserTable } from "@/components/AdminUserTable";
import { AdminGroupTable } from "@/components/AdminGroupTable";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          navigate("/auth");
          return;
        }

        // Check if user is a global admin
        const { data, error } = await supabase.rpc("is_global_admin", {
          _user_id: user.id,
        });

        if (error) throw error;

        if (!data) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access the admin dashboard.",
            variant: "destructive",
          });
          navigate("/groups");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Error checking admin status");
        toast({
          title: "Error",
          description: "Failed to verify admin access.",
          variant: "destructive",
        });
        navigate("/groups");
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [navigate, toast]);

  if (loading || isAdmin === null) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <AdminUserTable />
          </TabsContent>

          <TabsContent value="groups" className="mt-6">
            <AdminGroupTable />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
