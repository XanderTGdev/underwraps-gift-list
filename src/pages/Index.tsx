import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gift, Users, ShieldCheck, Sparkles } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      navigate("/groups");
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-600 mb-6 shadow-lg dark:bg-teal-500">
            <Gift className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-teal-700 dark:text-teal-300">
            Under Wraps
          </h1>

          <p className="text-xl text-gray-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
            The secret to perfect gift-giving. Create wishlists, form groups, and claim gifts without spoiling the surprise.
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <div className="w-12 h-12 rounded-lg bg-teal-600 flex items-center justify-center mb-4 mx-auto dark:bg-teal-500">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">Create Groups</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Form gift groups with friends and family to share wishlists
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <div className="w-12 h-12 rounded-lg bg-rose-400 flex items-center justify-center mb-4 mx-auto dark:bg-rose-400">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">Secret Claims</h3>
              <p className="text-gray-600 dark:text-slate-400">
                Claim gifts on others' lists with reveal dates to keep surprises intact
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
