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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_profiles: {
        Row: {
          availability: string
          blood_group: string
          created_at: string
          is_visible_to_recipients: boolean
          last_donation_date: string | null
          max_travel_km: number
          notes: string | null
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          availability: string
          blood_group: string
          created_at: string
          is_visible_to_recipients?: boolean
          last_donation_date?: string | null
          max_travel_km?: number
          notes?: string | null
          preferences?: Json
          updated_at: string
          user_id: string
        }
        Update: {
          availability?: string
          blood_group?: string
          created_at?: string
          is_visible_to_recipients?: boolean
          last_donation_date?: string | null
          max_travel_km?: number
          notes?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_responses: {
        Row: {
          created_at: string
          donor_id: string
          id: string
          message: string | null
          request_id: string
          share_contact: boolean
          status: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          created_at: string
          donor_id: string
          id: string
          message?: string | null
          request_id: string
          share_contact?: boolean
          status: string
          updated_at: string
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          donor_id?: string
          id?: string
          message?: string | null
          request_id?: string
          share_contact?: boolean
          status?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_responses_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          additional_info: string | null
          approx_lat: number | null
          approx_lng: number | null
          area: string | null
          blood_group: string | null
          city: string
          contact_instructions: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          hospital_name: string
          id: string
          is_demo: boolean
          moderation_note: string | null
          reference: string
          removed_by: string | null
          request_type: string
          requester_id: string
          required_by: string
          resolved_at: string | null
          status: string
          units_fulfilled: number
          units_required: number
          updated_at: string
          urgency: string
        }
        Insert: {
          additional_info?: string | null
          approx_lat?: number | null
          approx_lng?: number | null
          area?: string | null
          blood_group?: string | null
          city: string
          contact_instructions?: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          hospital_name: string
          id: string
          is_demo?: boolean
          moderation_note?: string | null
          reference: string
          removed_by?: string | null
          request_type: string
          requester_id: string
          required_by: string
          resolved_at?: string | null
          status: string
          units_fulfilled?: number
          units_required: number
          updated_at: string
          urgency: string
        }
        Update: {
          additional_info?: string | null
          approx_lat?: number | null
          approx_lng?: number | null
          area?: string | null
          blood_group?: string | null
          city?: string
          contact_instructions?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          hospital_name?: string
          id?: string
          is_demo?: boolean
          moderation_note?: string | null
          reference?: string
          removed_by?: string | null
          request_type?: string
          requester_id?: string
          required_by?: string
          resolved_at?: string | null
          status?: string
          units_fulfilled?: number
          units_required?: number
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at: string
          id: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          approx_lat: number | null
          approx_lng: number | null
          area: string | null
          bio: string | null
          city: string | null
          created_at: string
          phone: string | null
          share_phone_with_matches: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          approx_lat?: number | null
          approx_lng?: number | null
          area?: string | null
          bio?: string | null
          city?: string | null
          created_at: string
          phone?: string | null
          share_phone_with_matches?: boolean
          updated_at: string
          user_id: string
        }
        Update: {
          age?: number | null
          approx_lat?: number | null
          approx_lng?: number | null
          area?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          phone?: string | null
          share_phone_with_matches?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at: string
          details?: string | null
          handled_by?: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_counters: {
        Row: {
          key: string
          value: number
        }
        Insert: {
          key: string
          value: number
        }
        Update: {
          key?: string
          value?: number
        }
        Relationships: []
      }
      store_meta: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      users: {
        Row: {
          account_status: string
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_admin: boolean
          is_demo: boolean
          last_login_at: string | null
          name: string
          onboarding_complete: boolean
          password_hash: string | null
          provider: string
          provider_id: string | null
          role: string
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          created_at: string
          email: string
          id: string
          is_admin?: boolean
          is_demo?: boolean
          last_login_at?: string | null
          name: string
          onboarding_complete?: boolean
          password_hash?: string | null
          provider: string
          provider_id?: string | null
          role: string
          suspended_reason?: string | null
          updated_at: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          is_demo?: boolean
          last_login_at?: string | null
          name?: string
          onboarding_complete?: boolean
          password_hash?: string | null
          provider?: string
          provider_id?: string | null
          role?: string
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      verifications: {
        Row: {
          evidence_note: string | null
          id: string
          is_demo: boolean
          organization_name: string | null
          organization_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          evidence_note?: string | null
          id: string
          is_demo?: boolean
          organization_name?: string | null
          organization_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        Update: {
          evidence_note?: string | null
          id?: string
          is_demo?: boolean
          organization_name?: string | null
          organization_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      heal_connect_apply: { Args: { p_changes: Json }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
