import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClaimItemDialogProps {
  item: {
    id: string;
    title: string;
    wishlist_id: string;
  } | null;
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ClaimItemDialog = ({ item, groupId, open, onOpenChange, onSuccess }: ClaimItemDialogProps) => {
  const [revealDate, setRevealDate] = useState<Date>();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    if (!item || !revealDate) {
      toast.error("Please select a reveal date");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('claim-item', {
        body: {
          itemId: item.id,
          groupId,
          revealDate: format(revealDate, "yyyy-MM-dd"),
          note: note || undefined,
        },
      });

      if (error) throw error;

      toast.success("Item claimed successfully!");
      setRevealDate(undefined);
      setNote("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to claim item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Claim Item</DialogTitle>
          <DialogDescription>
            {item?.title && `Claim "${item.title}" and set when it should be revealed.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reveal-date">Reveal Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="reveal-date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !revealDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {revealDate ? format(revealDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={revealDate}
                  onSelect={setRevealDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              The wishlist owner will see your claim after this date
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Add a note about your claim..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleClaim} disabled={loading || !revealDate}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Claim Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimItemDialog;
