import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Loader2, Shield, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(1, { message: "Password is required" })
});

const signupSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100, { message: "Name must be less than 100 characters" }),
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string()
    .min(12, { message: "Password must be at least 12 characters" })
    .regex(/[A-Z]/, { message: "Password must include an uppercase letter" })
    .regex(/[a-z]/, { message: "Password must include a lowercase letter" })
    .regex(/[0-9]/, { message: "Password must include a number" })
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/groups";
  // Sanitize the redirect URL
  const redirectUrl = (redirect.startsWith("/") && !redirect.startsWith("//")) ? redirect : "/groups";
  const inviteGroupRaw = searchParams.get("inviteGroup");
  // Sanitize inviteGroup
  const inviteGroup = inviteGroupRaw ? inviteGroupRaw.slice(0, 100).replace(/[<>]/g, '') : null;
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");

  // Password strength calculation
  const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 12) score += 25;
    if (password.length >= 16) score += 15;
    if (/[a-z]/.test(password)) score += 15;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    if (score < 40) return { score, label: "Weak", color: "bg-red-500" };
    if (score < 70) return { score, label: "Fair", color: "bg-yellow-500" };
    if (score < 90) return { score, label: "Good", color: "bg-blue-500" };
    return { score, label: "Strong", color: "bg-green-500" };
  };

  const passwordStrength = calculatePasswordStrength(signupPassword);

  // Check if already authenticated and redirect
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(redirectUrl);
      }
    };
    checkAuth();
  }, [navigate, redirectUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = loginSchema.safeParse({
      email: loginEmail.trim(),
      password: loginPassword
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) throw error;
      toast.success("Welcome back!");
      navigate(redirectUrl);
    } catch (error: any) {
      toast.error("Failed to sign in");
    } finally {
      setLoginPassword("");
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = signupSchema.safeParse({
      name: signupName.trim(),
      email: signupEmail.trim(),
      password: signupPassword
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            name: validation.data.name,
          },
          emailRedirectTo: `${window.location.origin}${redirectUrl}`,
        },
      });

      if (error) throw error;
      toast.success("Account created! Please check your email.");

      // Wait a moment for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 500));

      navigate(redirectUrl);
    } catch (error: any) {
      toast.error("Failed to sign up");
    } finally {
      setSignupPassword("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-600 mb-4 dark:bg-teal-500">
            {inviteGroup ? <Mail className="w-8 h-8 text-white" /> : <Gift className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-4xl font-bold text-teal-700 dark:text-teal-300">
            {inviteGroup ? "You're Invited!" : "Under Wraps"}
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mt-2">
            {inviteGroup
              ? `Sign in or create an account to join ${inviteGroup}`
              : "Secret gift planning made simple"}
          </p>
        </div>

        <Card>
          <Tabs defaultValue={inviteGroup ? "signup" : "login"} className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your name"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      minLength={12}
                      placeholder="Minimum 12 characters"
                    />
                    <p className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Use at least 12 characters with mix of letters, numbers & symbols
                    </p>
                    {signupPassword && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-slate-400">Password strength:</span>
                          <span className={`font-medium ${passwordStrength.score < 40 ? 'text-red-600' :
                            passwordStrength.score < 70 ? 'text-yellow-600' :
                              passwordStrength.score < 90 ? 'text-blue-600' :
                                'text-green-600'
                            }`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <Progress value={passwordStrength.score} className="h-1.5" />
                      </div>
                    )}
                    {signupPassword && signupPassword.length < 12 && (
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Password must be at least 12 characters
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
