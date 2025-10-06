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
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-primary mb-6 shadow-glow">
            <Gift className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Under Wraps
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            The secret to perfect gift-giving. Create wishlists, form groups, and claim gifts without spoiling the surprise.
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 bg-gradient-primary hover:opacity-90 shadow-glow"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-xl bg-card shadow-soft">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Create Groups</h3>
              <p className="text-muted-foreground">
                Form gift groups with friends and family to share wishlists
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card shadow-soft">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4 mx-auto">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secret Claims</h3>
              <p className="text-muted-foreground">
                Claim gifts on others' lists with reveal dates to keep surprises intact
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card shadow-soft">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Auto-Fetch Items</h3>
              <p className="text-muted-foreground">
                Paste any product URL and we'll automatically fetch details
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
