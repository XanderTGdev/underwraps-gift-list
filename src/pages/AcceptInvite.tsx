import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type InvitationStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'error';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<InvitationStatus>('loading');
  const [groupName, setGroupName] = useState<string>("");
  const [invitation, setInvitation] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    checkAuthAndInvitation();
  }, [token]);

  const checkAuthAndInvitation = async () => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    try {
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setUserEmail(user?.email || "");

      // Use secure server-side token validation
      // This prevents token exposure through client-side queries
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_invitation_token', {
          _token: token,
          _user_email: user?.email || ""
        });

      if (validationError || !validationData || validationData.length === 0) {
        setStatus('invalid');
        return;
      }

      const inviteData = validationData[0];
      
      // Create invitation object matching expected format
      const invitation = {
        id: inviteData.invitation_id,
        group_id: inviteData.group_id,
        invitee_email: inviteData.invitee_email,
        status: inviteData.status,
        expires_at: inviteData.expires_at,
      };

      setInvitation(invitation);
      setGroupName(inviteData.group_name || "Unknown Group");

      // Check if already accepted
      if (inviteData.status === 'accepted') {
        setStatus('accepted');
        return;
      }

      // Check if expired
      if (new Date(inviteData.expires_at) < new Date()) {
        setStatus('expired');
        return;
      }

      // Check validation result
      if (inviteData.is_valid) {
        setStatus('valid');
        return;
      }

      setStatus('invalid');
    } catch (error) {
      console.error("Error checking invitation:", error);
      setStatus('error');
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation || !isAuthenticated) return;

    setStatus('loading');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please log in to accept this invitation");
        navigate(`/auth?redirect=/accept-invite?token=${token}`);
        return;
      }

      // Check if user's email matches the invitation
      if (user.email !== invitation.invitee_email) {
        toast.error(`This invitation is for ${invitation.invitee_email}. Please log in with that email.`);
        setStatus('invalid');
        return;
      }

      // Add user to group
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: invitation.group_id,
          user_id: user.id,
        });

      if (memberError) {
        if (memberError.code === '23505') { // Unique constraint violation
          toast.error("You are already a member of this group");
        } else {
          throw memberError;
        }
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from("invitations")
        .update({ status: 'accepted' })
        .eq("id", invitation.id);

      if (updateError) throw updateError;

      toast.success(`You've joined ${groupName}!`);
      setStatus('accepted');
      
      // Redirect to the group after a short delay
      setTimeout(() => {
        navigate(`/groups/${invitation.group_id}`);
      }, 2000);

    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error("Failed to accept invitation. Please try again.");
      setStatus('error');
    }
  };

  const handleLogin = () => {
    navigate(`/auth?redirect=/accept-invite?token=${token}`);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/groups")} className="w-full">
              Go to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-warning" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please request a new invitation from the group owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/groups")} className="w-full">
              Go to Groups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Already Accepted</CardTitle>
            <CardDescription>
              You've already accepted this invitation to {groupName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/groups/${invitation?.group_id}`)} className="w-full">
              Go to Group
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'valid' && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Join {groupName}</CardTitle>
            <CardDescription>
              You've been invited to join this group. Please log in or sign up to accept the invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Invited email: <strong>{invitation?.invitee_email}</strong>
            </p>
            <Button onClick={handleLogin} className="w-full">
              Log In to Accept
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'valid' && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Join {groupName}?</CardTitle>
            <CardDescription>
              You've been invited to join this group.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Invited email: <strong>{invitation?.invitee_email}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Your email: <strong>{userEmail}</strong>
              </p>
            </div>
            {userEmail !== invitation?.invitee_email && (
              <div className="bg-warning/10 border border-warning p-3 rounded-lg">
                <p className="text-sm text-warning font-medium">
                  Email mismatch: This invitation is for a different email address.
                </p>
              </div>
            )}
            <Button 
              onClick={handleAcceptInvitation} 
              className="w-full"
              disabled={userEmail !== invitation?.invitee_email}
            >
              Accept Invitation
            </Button>
            <Button 
              onClick={() => navigate("/groups")} 
              variant="outline" 
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            Something went wrong. Please try again or contact support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/groups")} className="w-full">
            Go to Groups
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
