import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddItemDialogProps {
  wishlistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AddItemDialog = ({ wishlistId, open, onOpenChange, onSuccess }: AddItemDialogProps) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [itemData, setItemData] = useState<any>(null);
  const [note, setNote] = useState("");

  const handleFetchMetadata = async () => {
    if (!url) return;

    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-product-metadata", {
        body: { url },
      });

      if (error) throw error;

      setItemData(data);
      toast.success("Product details fetched!");
    } catch (error: any) {
      toast.error("Failed to fetch product details. You can still add it manually.");
      setItemData({ url, title: "", price: null, currency: "USD", image_url: "" });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!itemData) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("items").insert({
        wishlist_id: wishlistId,
        url: itemData.resolved_url || url,
        title: itemData.title || url,
        price: itemData.price,
        currency: itemData.currency || "USD",
        image_url: itemData.image_url,
        note,
        quantity: 1,
        allow_multiple_claims: false,
      });

      if (error) throw error;

      toast.success("Item added to wishlist!");
      setUrl("");
      setItemData(null);
      setNote("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Wishlist</DialogTitle>
          <DialogDescription>
            Paste a product URL to automatically fetch details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-url">Product URL</Label>
            <div className="flex gap-2">
              <Input
                id="item-url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={fetching || loading}
              />
              <Button
                onClick={handleFetchMetadata}
                disabled={!url || fetching || loading}
              >
                {fetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Fetch Details"
                )}
              </Button>
            </div>
          </div>

          {itemData && (
            <>
              {itemData.image_url && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={itemData.image_url}
                    alt={itemData.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="item-title">Title</Label>
                <Input
                  id="item-title"
                  value={itemData.title}
                  onChange={(e) => setItemData({ ...itemData, title: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-price">Price</Label>
                  <Input
                    id="item-price"
                    type="number"
                    step="0.01"
                    value={itemData.price || ""}
                    onChange={(e) =>
                      setItemData({ ...itemData, price: parseFloat(e.target.value) })
                    }
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-currency">Currency</Label>
                  <Input
                    id="item-currency"
                    value={itemData.currency}
                    onChange={(e) => setItemData({ ...itemData, currency: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-note">Note (optional)</Label>
                <Textarea
                  id="item-note"
                  placeholder="Add a note about this item..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!itemData || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Wishlist"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddItemDialog;
