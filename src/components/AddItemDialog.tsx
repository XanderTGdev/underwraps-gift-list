import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

// Basic client-side validation for UX - database constraints provide final validation
const itemSchema = z.object({
  title: z.string()
    .trim()
    .min(1, { message: "Title is required" }),
  url: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  price: z.number().positive({ message: "Price must be positive" }).optional(),
  imageUrl: z.string().url({ message: "Invalid image URL" }).optional().or(z.literal('')),
  note: z.string().optional()
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

  // URL metadata auto-fill state
  const [metaLoading, setMetaLoading] = useState(false);
  const [touchedTitle, setTouchedTitle] = useState(false);
  const [touchedPrice, setTouchedPrice] = useState(false);
  const [touchedImageUrl, setTouchedImageUrl] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  const isValidHttpUrl = (value: string) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const fetchAndAutofillMetadata = async (u: string) => {
    if (!u || !isValidHttpUrl(u)) return;
    if (u === lastFetchedUrl) return;
    setMetaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-product-metadata", {
        body: { url: u }
      });
      if (error) throw error;
      if (!data?.success) {
        setLastFetchedUrl(u);
        return;
      }

      const {
        title: fetchedTitle,
        price: fetchedPrice,
        imageUrl: fetchedImageUrl,
        currency: fetchedCurrency
      } = data as { title?: string; price?: number; imageUrl?: string; currency?: string };

      if (!touchedTitle && !title.trim() && typeof fetchedTitle === "string" && fetchedTitle.trim()) {
        setTitle(fetchedTitle.trim());
      }
      if (!touchedPrice && !price.trim() && typeof fetchedPrice === "number") {
        const normalized = Number.isFinite(fetchedPrice) ? fetchedPrice.toFixed(2) : String(fetchedPrice);
        setPrice(normalized);
      }
      if (!touchedImageUrl && !imageUrl.trim() && typeof fetchedImageUrl === "string" && fetchedImageUrl.trim()) {
        setImageUrl(fetchedImageUrl.trim());
      }
      if (typeof fetchedCurrency === "string" && fetchedCurrency.trim()) {
        setCurrency(fetchedCurrency.toUpperCase());
      }

      setLastFetchedUrl(u);
    } catch (err) {
      // Silently ignore metadata fetch errors; manual input remains available
      console.debug("Metadata fetch failed", err);
    } finally {
      setMetaLoading(false);
    }
  };

  // Debounce URL changes and fetch metadata when URL is valid
  useEffect(() => {
    const u = url.trim();
    if (!u || !isValidHttpUrl(u) || u === lastFetchedUrl) return;
    const handle = window.setTimeout(() => {
      fetchAndAutofillMetadata(u);
    }, 600);
    return () => window.clearTimeout(handle);
  }, [url, lastFetchedUrl]);
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
          <Input id="item-title" placeholder="Item title" value={title} onChange={e => { if (!touchedTitle) setTouchedTitle(true); setTitle(e.target.value); }} disabled={loading} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-url">Product URL (optional)</Label>
          <div className="flex items-center gap-2">
            <Input id="item-url" type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} disabled={loading} />
            {metaLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="item-price">Price (optional)</Label>
            <Input id="item-price" type="number" step="0.01" placeholder="0.00" value={price} onChange={e => { if (!touchedPrice) setTouchedPrice(true); setPrice(e.target.value); }} disabled={loading} />
          </div>

        </div>

        <div className="space-y-2">
          <Label htmlFor="item-image">Image URL (optional)</Label>
          <Input id="item-image" type="url" placeholder="https://..." value={imageUrl} onChange={e => { if (!touchedImageUrl) setTouchedImageUrl(true); setImageUrl(e.target.value); }} disabled={loading} />
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