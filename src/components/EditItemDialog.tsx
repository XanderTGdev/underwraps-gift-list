import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditItemDialogProps {
  item: {
    id: string;
    title: string;
    url: string;
    price: number | null;
    currency: string;
    image_url: string | null;
    note: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EditItemDialog = ({
  item,
  open,
  onOpenChange,
  onSuccess
}: EditItemDialogProps) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [imageUrl, setImageUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setUrl(item.url || "");
      setPrice(item.price ? item.price.toString() : "");
      setCurrency(item.currency || "USD");
      setImageUrl(item.image_url || "");
      setNote(item.note || "");
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !title.trim()) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('edit-item', {
        body: {
          itemId: item.id,
          title: title.trim(),
          url: url || undefined,
          price: price ? parseFloat(price) : undefined,
          imageUrl: imageUrl || undefined,
          note: note || undefined,
          currency,
        },
      });

      if (error) throw error;

      toast.success("Item updated successfully!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Update item details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-item-title">Title *</Label>
            <Input
              id="edit-item-title"
              placeholder="Item title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-item-url">Product URL (optional)</Label>
            <Input
              id="edit-item-url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-price">Price (optional)</Label>
              <Input
                id="edit-item-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-item-image">Image URL (optional)</Label>
            <Input
              id="edit-item-image"
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-item-note">Note (optional)</Label>
            <Textarea
              id="edit-item-note"
              placeholder="Add a note about this item..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditItemDialog;
