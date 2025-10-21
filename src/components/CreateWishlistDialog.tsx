import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateWishlistDialogProps {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (wishlistId: string) => void;
}

const CreateWishlistDialog = ({
  groupId,
  open,
  onOpenChange,
  onSuccess,
}: CreateWishlistDialogProps) => {
  const [wishlistName, setWishlistName] = useState("");
  const [defaultName, setDefaultName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      // Fetch user's first name to generate default wishlist name
      const fetchUserName = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .single();

          if (profile?.name) {
            // Extract first name (everything before the first space)
            const extractedFirstName = profile.name.split(" ")[0];
            setFirstName(extractedFirstName);
            const defaultWishlistName = `${extractedFirstName}'s Wishlist`;
            setDefaultName(defaultWishlistName);
          } else {
            setFirstName("");
            setDefaultName("My Wishlist");
          }
        }
      };
      fetchUserName();
      setWishlistName(""); // Reset the input field
    }
  }, [open]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Sanitize input - remove control characters and trim
      const sanitizedName = wishlistName.replace(/[\x00-\x1F\x7F]/g, '').trim();
      const sanitizedFirstName = firstName.replace(/[\x00-\x1F\x7F]/g, '').trim();

      // If user provided a name, use it. Otherwise, send undefined to trigger auto-generation
      const nameToSend = sanitizedName || undefined;

      const { data, error } = await supabase.functions.invoke('create-wishlist', {
        body: {
          groupId,
          name: nameToSend,
          userFirstName: sanitizedFirstName || undefined // Pass first name for default generation
        },
      });

      if (error) throw error;

      toast.success("Wishlist created!");
      onOpenChange(false);
      onSuccess(data.wishlist.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to create wishlist");
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !creating) {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Wishlist</DialogTitle>
          <DialogDescription>
            Give your wishlist a name. Leave blank to use "{defaultName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wishlist-name">Wishlist Name</Label>
            <Input
              id="wishlist-name"
              placeholder={defaultName}
              value={wishlistName}
              onChange={(e) => setWishlistName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={creating}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Wishlist"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWishlistDialog;

