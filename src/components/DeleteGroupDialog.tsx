import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DeleteGroupDialogProps {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DeleteGroupDialog = ({
  groupId,
  groupName,
  open,
  onOpenChange,
}: DeleteGroupDialogProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleDeleteGroup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to delete a group");
        return;
      }

      const { data, error } = await supabase.functions.invoke("delete-group", {
        body: { groupId },
      });

      if (error) {
        toast.error(error.message || "Failed to delete group");
        return;
      }

      toast.success("Group deleted successfully");
      onOpenChange(false);
      // Navigate back to groups page
      navigate("/groups");
    } catch (error: any) {
      console.error("Error deleting group");
      toast.error("Failed to delete group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Group</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{groupName}"? This action cannot be
            undone. All members, wishlists, and items in this group will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end pt-4">
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteGroup}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteGroupDialog;
