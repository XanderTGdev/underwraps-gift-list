import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ExternalLink, Gift, Calendar, Trash2, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import AddItemDialog from "@/components/AddItemDialog";
import EditItemDialog from "@/components/EditItemDialog";
import ClaimItemDialog from "@/components/ClaimItemDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Item {
  id: string;
  wishlist_id: string;
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
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimingItem, setClaimingItem] = useState<Item | null>(null);
  const [groupId, setGroupId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

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
          group_id,
          profiles (name)
        `)
        .eq("id", wishlistId)
        .single();

      if (wishlistError) throw wishlistError;

      setWishlistName(wishlist.name);
      setWishlistOwnerId(wishlist.user_id);
      setGroupId(wishlist.group_id);

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

      // Sort items: unclaimed first, then claimed
      const sortedItems = mappedItems.sort((a, b) => {
        const aIsClaimed = a.claims && a.claims.length > 0 && !a.allow_multiple_claims;
        const bIsClaimed = b.claims && b.claims.length > 0 && !b.allow_multiple_claims;

        if (aIsClaimed === bIsClaimed) return 0;
        return aIsClaimed ? 1 : -1;
      });

      setItems(sortedItems);
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

  const handleUnclaim = async (claimId: string) => {
    try {
      const { error } = await supabase.functions.invoke('unclaim-item', {
        body: { claimId },
      });

      if (error) throw error;

      toast.success("Item unclaimed successfully");
      fetchWishlist();
    } catch (error: any) {
      toast.error(error.message || "Failed to unclaim item");
    }
  };

  const canClaimItem = (item: Item) => {
    if (isOwner) return false;
    if (!item.allow_multiple_claims && item.claims && item.claims.length > 0) {
      return false;
    }
    return true;
  };

  const getUserClaim = (item: Item) => {
    return item.claims?.find((c) => c.claimer_id === currentUserId);
  };

  const isItemFullyClaimed = (item: Item) => {
    return item.claims && item.claims.length > 0 && !item.allow_multiple_claims;
  };

  const handleDeleteWishlist = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-wishlist', {
        body: { wishlistId },
      });

      if (error) throw error;

      toast.success("Wishlist deleted successfully");
      navigate(`/groups/${groupId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete wishlist");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteWishlistClick = () => {
    if (items.length === 0) {
      // No confirmation needed for empty wishlists
      handleDeleteWishlist();
    } else {
      // Show confirmation dialog for wishlists with items
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;

    setIsDeletingItem(true);
    try {
      const { error } = await supabase.functions.invoke('delete-item', {
        body: { itemId: deletingItem.id },
      });

      if (error) throw error;

      toast.success("Item deleted successfully");
      fetchWishlist();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete item");
    } finally {
      setIsDeletingItem(false);
      setDeleteItemDialogOpen(false);
      setDeletingItem(null);
    }
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/groups/${groupId}`)}
          className="gap-2 px-3 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Group
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold mb-2">{wishlistName}</h1>
              <p className="text-muted-foreground">
                {isOwner ? "Your wishlist" : `${wishlistName}'s wishlist`}
              </p>
            </div>
          </div>
          {isOwner && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleDeleteWishlistClick}
                disabled={isDeleting}
                className="gap-2 text-destructive hover:text-destructive w-full sm:w-auto"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Wishlist
                  </>
                )}
              </Button>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
            {items.map((item) => {
              const isFullyClaimed = isItemFullyClaimed(item);
              const isUserClaim = getUserClaim(item);

              return (
                <Card
                  key={item.id}
                  className={`group overflow-hidden transition-all flex flex-col h-full ${isOwner ? 'cursor-pointer' : ''
                    } ${isFullyClaimed && !isUserClaim
                      ? 'opacity-30 grayscale pointer-events-none'
                      : 'hover:border-teal-500 hover:shadow-lg'
                    }`}
                  onClick={() => {
                    if (isOwner) {
                      setEditingItem(item);
                      setEditDialogOpen(true);
                    }
                  }}
                >
                  <div className="aspect-video bg-gray-100 dark:bg-slate-800 overflow-hidden relative">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-24 h-24 text-gray-400 dark:text-gray-600" />
                      </div>
                    )}
                    {isFullyClaimed && !isUserClaim && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Badge variant="secondary" className="text-lg font-semibold">Unavailable</Badge>
                      </div>
                    )}
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingItem(item);
                          setDeleteItemDialogOpen(true);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        title="Delete item"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <CardHeader className="flex-shrink-0">
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
                  <CardContent className="space-y-3 flex-grow flex flex-col">
                    <div className="flex items-center gap-2">
                      {getClaimStatus(item)}
                      {item.quantity > 1 && (
                        <Badge variant="outline">Qty: {item.quantity}</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 xmt-auto">
                      {item.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(item.url, "_blank");
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Item
                        </Button>
                      )}
                      {!isOwner && (
                        <>
                          {canClaimItem(item) && (
                            <Button
                              variant="default"
                              size="sm"
                              className={`gap-2 ${!item.url ? 'flex-1' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setClaimingItem(item);
                                setClaimDialogOpen(true);
                              }}
                              disabled={isFullyClaimed && !isUserClaim}
                            >
                              <Gift className="w-4 h-4" />
                              Claim
                            </Button>
                          )}
                          {getUserClaim(item) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`gap-2 ${!item.url ? 'flex-1' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnclaim(getUserClaim(item).id);
                              }}
                            >
                              Unclaim
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      <ClaimItemDialog
        item={claimingItem}
        groupId={groupId}
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        onSuccess={fetchWishlist}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Delete Wishlist</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-red-600 dark:text-red-400">
                This action is permanent and cannot be undone!
              </p>
              <p>
                Deleting your wishlist "{wishlistName}" will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>Permanently delete all {items.length} item{items.length !== 1 ? 's' : ''} in this wishlist</li>
                <li>Remove all claims made by other group members</li>
                <li>Make this wishlist inaccessible to all group members</li>
              </ul>
              <p className="font-medium text-center mt-4">
                Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWishlist}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Wishlist"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteItemDialogOpen} onOpenChange={setDeleteItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingItem}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isDeletingItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingItem ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Item"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Wishlist;
