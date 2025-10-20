import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gift, LogOut, Users, Shield } from "lucide-react";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase.rpc("is_global_admin", {
        _user_id: user.id,
      });

      if (!error && data) {
        setIsAdmin(true);
      }
    };

    checkAdminStatus();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm dark:bg-slate-900/80 dark:border-slate-700">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/groups")}
            className="flex items-center gap-2 px-0 hover:bg-transparent"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center dark:bg-teal-500">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-teal-700 dark:text-teal-300">
              Under Wraps
            </span>
          </Button>

          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/groups")}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Groups
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-2"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default Layout;
