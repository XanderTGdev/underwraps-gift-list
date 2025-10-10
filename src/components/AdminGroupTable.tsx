import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GroupWithMembers {
  id: string;
  name: string;
  created_at: string;
  members: {
    user_id: string;
    profile: {
      name: string | null;
      email: string;
    } | null;
  }[];
}

export const AdminGroupTable = () => {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);

        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select(`
            id,
            name,
            created_at,
            group_members (
              user_id,
              profiles (
                name,
                email
              )
            )
          `)
          .order("created_at", { ascending: false });

        if (groupsError) throw groupsError;

        const formattedGroups = groupsData?.map((group: any) => ({
          id: group.id,
          name: group.name,
          created_at: group.created_at,
          members: group.group_members.map((member: any) => ({
            user_id: member.user_id,
            profile: member.profiles,
          })),
        })) || [];

        setGroups(formattedGroups);
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast({
          title: "Error",
          description: "Failed to load groups.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group Name</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.id}>
              <TableCell className="font-medium">{group.name}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {group.members.map((member, idx) => (
                    <Badge key={idx} variant="outline">
                      {member.profile?.name || member.profile?.email || "Unknown"}
                    </Badge>
                  ))}
                  {group.members.length === 0 && (
                    <span className="text-muted-foreground text-sm">No members</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {new Date(group.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
