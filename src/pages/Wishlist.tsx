import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ExternalLink, Gift, Calendar } from "lucide-react";
import { toast } from "sonner";
import AddItemDialog from "@/components/AddItemDialog";
import EditItemDialog from "@/components/EditItemDialog";

interface Item {
  id: string;
  url: string;
  title: string;
  price: number;
  currency: string;
  image_url: string;
  note: string;
  quantity: number;
  allow_multiple_claims: boolean;
  claims: any[];
}

const Wishlist = () => {
  const { wishlistId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wishlistName, setWishlistName] = useState("");
  const [wishlistOwnerId, setWishlistOwnerId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchWishlist();
  }, [wishlistId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);
  };

  const fetchWishlist = async () => {
    try {
      const { data: wishlist, error: wishlistError } = await supabase
        .from("wishlists")
        .select(`
          name,
          user_id,
          profiles (name)
        `)
        .eq("id", wishlistId)
        .single();

      if (wishlistError) throw wishlistError;

      setWishlistName(wishlist.name);
      setWishlistOwnerId(wishlist.user_id);

      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === wishlist.user_id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select(`
          *,
          item_claims (
            id,
            claimer_id,
            reveal_date,
            profiles (name)
          )
        `)
        .eq("wishlist_id", wishlistId)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;

      const mappedItems = itemsData?.map(item => ({
        ...item,
        claims: item.item_claims
      })) || [];
      setItems(mappedItems);
    } catch (error: any) {
      toast.error("Failed to load wishlist");
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  };

  const getClaimStatus = (item: Item) => {
    if (!item.claims || item.claims.length === 0) return null;

    if (isOwner) {
      const revealedClaims = item.claims.filter(
        (claim) => new Date(claim.reveal_date) <= new Date()
      );
      if (revealedClaims.length > 0) {
        return (
          <Badge variant="secondary" className="gap-1">
            <Gift className="w-3 h-3" />
            Claimed by {revealedClaims[0].profiles.name}
          </Badge>
        );
      }
      return null;
    }

    const myClaim = item.claims.find((c) => c.claimer_id === currentUserId);
    if (myClaim) {
      return (
        <Badge variant="claimed" className="gap-1">
          <Gift className="w-3 h-3" />
          You claimed this
        </Badge>
      );
    }

    return (
      <Badge variant="claimed" className="gap-1">
        <Gift className="w-3 h-3" />
        Claimed by {item.claims[0].profiles.name}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{wishlistName}</h1>
            <p className="text-muted-foreground">
              {isOwner ? "Your wishlist" : `${wishlistName}'s wishlist`}
            </p>
          </div>
          {isOwner && (
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Gift className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">No items yet</h3>
              <p className="text-gray-600 dark:text-slate-400 text-center mb-6 max-w-md">
                {isOwner
                  ? "Add your first item to start building your wishlist"
                  : "This wishlist is empty"}
              </p>
              {isOwner && (
                <Button
                  onClick={() => setAddDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Item
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className={`overflow-hidden hover:border-teal-500 hover:shadow-lg transition-all ${isOwner ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isOwner) {
                    setEditingItem(item);
                    setEditDialogOpen(true);
                  }
                }}
              >
                {item.image_url && (
                  <div className="aspect-video bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2 text-slate-900 dark:text-slate-100">{item.title}</CardTitle>
                    {item.price && (
                      <span className="text-rose-500 dark:text-rose-400 font-bold whitespace-nowrap">
                        {item.currency} {item.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <CardDescription className="line-clamp-2">{item.note}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {getClaimStatus(item)}
                    {item.quantity > 1 && (
                      <Badge variant="outline">Qty: {item.quantity}</Badge>
                    )}
                  </div>
                  {item.url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(item.url, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Item
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddItemDialog
        wishlistId={wishlistId || ""}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchWishlist}
      />

      <EditItemDialog
        item={editingItem}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchWishlist}
      />
    </Layout>
  );
};

export default Wishlist;
