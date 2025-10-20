import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

// Basic client-side validation for UX - server validates thoroughly
const inviteSchema = z.object({
  email: z.string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email address" })
});

interface InviteMemberDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const InviteMemberDialog = ({ groupId, open, onOpenChange, onSuccess }: InviteMemberDialogProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email with Zod
    const validation = inviteSchema.safeParse({ email: email.trim() });
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { groupId, inviteeEmail: validation.data.email },
      });

      if (error) throw error;

      toast.success("Invitation sent!");
      setEmail("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberDialog;
