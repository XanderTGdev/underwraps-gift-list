import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const itemSchema = z.object({
  title: z.string()
    .trim()
    .min(1, { message: "Title is required" })
    .max(200, { message: "Title must be less than 200 characters" }),
  url: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  price: z.number().positive({ message: "Price must be positive" }).optional(),
  imageUrl: z.string().url({ message: "Invalid image URL" }).optional().or(z.literal('')),
  note: z.string().max(1000, { message: "Note must be less than 1000 characters" }).optional()
});
interface AddItemDialogProps {
  wishlistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
const AddItemDialog = ({
  wishlistId,
  open,
  onOpenChange,
  onSuccess
}: AddItemDialogProps) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [imageUrl, setImageUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    // Validate with Zod
    const validation = itemSchema.safeParse({
      title: title.trim(),
      url: url.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      note: note.trim() || undefined
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setLoading(true);
    try {
      const {
        error
      } = await supabase.from("items").insert({
        wishlist_id: wishlistId,
        url: validation.data.url || null,
        title: validation.data.title,
        price: validation.data.price || null,
        currency: currency || "USD",
        image_url: validation.data.imageUrl || null,
        note: validation.data.note || null,
        quantity: 1,
        allow_multiple_claims: false
      });
      if (error) throw error;
      toast.success("Item added to wishlist!");
      setTitle("");
      setUrl("");
      setPrice("");
      setCurrency("USD");
      setImageUrl("");
      setNote("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Wishlist</DialogTitle>
          <DialogDescription>
            Enter item details manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-title">Title *</Label>
            <Input id="item-title" placeholder="Item title" value={title} onChange={e => setTitle(e.target.value)} disabled={loading} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-url">Product URL (optional)</Label>
            <Input id="item-url" type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} disabled={loading} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-price">Price (optional)</Label>
              <Input id="item-price" type="number" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} disabled={loading} />
            </div>
            
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-image">Image URL (optional)</Label>
            <Input id="item-image" type="url" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-note">Note (optional)</Label>
            <Textarea id="item-note" placeholder="Add a note about this item..." value={note} onChange={e => setNote(e.target.value)} disabled={loading} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={!title.trim() || loading}>
            {loading ? <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </> : "Add to Wishlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
};
export default AddItemDialog;