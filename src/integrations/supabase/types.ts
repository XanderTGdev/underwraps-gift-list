export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          expires_at: string | null
          group_id: string
          id: string
          invitee_email: string
          inviter_id: string | null
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          group_id: string
          id?: string
          invitee_email: string
          inviter_id?: string | null
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          invitee_email?: string
          inviter_id?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      item_claims: {
        Row: {
          claimer_id: string
          created_at: string
          group_id: string
          id: string
          item_id: string
          note: string | null
          reveal_date: string
        }
        Insert: {
          claimer_id: string
          created_at?: string
          group_id: string
          id?: string
          item_id: string
          note?: string | null
          reveal_date: string
        }
        Update: {
          claimer_id?: string
          created_at?: string
          group_id?: string
          id?: string
          item_id?: string
          note?: string | null
          reveal_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_claims_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_claims_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          allow_multiple_claims: boolean
          created_at: string
          currency: string | null
          id: string
          image_url: string | null
          note: string | null
          price: number | null
          quantity: number
          title: string | null
          url: string | null
          wishlist_id: string
        }
        Insert: {
          allow_multiple_claims?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          note?: string | null
          price?: number | null
          quantity?: number
          title?: string | null
          url?: string | null
          wishlist_id: string
        }
        Update: {
          allow_multiple_claims?: boolean
          created_at?: string
          currency?: string | null
          id?: string
          image_url?: string | null
          note?: string | null
          price?: number | null
          quantity?: number
          title?: string | null
          url?: string | null
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_default?: boolean
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_with_email: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_email: {
        Args: { _profile_id: string; _viewer_id: string }
        Returns: boolean
      }
      get_user_group_role: {
        Args: { _group_id: string; _user_id: string }
        Returns: string
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_reveal_date_reached: {
        Args: { _reveal_date: string }
        Returns: boolean
      }
      users_share_group: {
        Args: { _user_id_1: string; _user_id_2: string }
        Returns: boolean
      }
      validate_invitation_token: {
        Args: { _token: string; _user_email: string }
        Returns: {
          expires_at: string
          group_id: string
          group_name: string
          invitation_id: string
          invitee_email: string
          is_valid: boolean
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
