/**
 * Database types for Cadence.
 *
 * Generated from the EXISTING Supabase schema (the schema is not recreated by
 * this app). Regenerate after any schema change with:
 *
 *   npx supabase gen types typescript --project-id <id> --schema public > src/types/db.ts
 *
 * Convenience row/enum aliases live at the bottom of this file.
 */

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          id: string
          org_id: string | null
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          id?: string
          org_id?: string | null
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          id?: string
          org_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allowed_domains: string[]
          base_currency: string
          created_at: string
          default_cadence: Database["public"]["Enums"]["period_cadence"]
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          allowed_domains?: string[]
          base_currency?: string
          created_at?: string
          default_cadence?: Database["public"]["Enums"]["period_cadence"]
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          allowed_domains?: string[]
          base_currency?: string
          created_at?: string
          default_cadence?: Database["public"]["Enums"]["period_cadence"]
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          email: string
          full_name: string | null
          id: string
          org_id: string | null
          rate: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          created_at?: string
          currency?: string
          email: string
          full_name?: string | null
          id: string
          org_id?: string | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          created_at?: string
          currency?: string
          email?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_rows: {
        Row: {
          billable: boolean
          created_at: string
          description: string | null
          hours: number
          id: string
          org_id: string
          project: string | null
          row_date: string
          timesheet_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          org_id: string
          project?: string | null
          row_date: string
          timesheet_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          org_id?: string
          project?: string | null
          row_date?: string
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_rows_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_total: number | null
          created_at: string
          currency_snapshot: string | null
          employee_id: string
          id: string
          org_id: string
          period_end: string
          period_start: string
          rate_snapshot: number | null
          rate_type_snapshot: string | null
          raw_file_path: string | null
          rejection_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_total?: number | null
          created_at?: string
          currency_snapshot?: string | null
          employee_id: string
          id?: string
          org_id: string
          period_end: string
          period_start: string
          rate_snapshot?: number | null
          rate_type_snapshot?: string | null
          raw_file_path?: string | null
          rejection_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_total?: number | null
          created_at?: string
          currency_snapshot?: string | null
          employee_id?: string
          id?: string
          org_id?: string
          period_end?: string
          period_start?: string
          rate_snapshot?: number | null
          rate_type_snapshot?: string | null
          raw_file_path?: string | null
          rejection_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          id: string
          last_attempted_at: string | null
          org_id: string
          payload: Json
          status: string
          timesheet_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_attempted_at?: string | null
          org_id: string
          payload: Json
          status?: string
          timesheet_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_attempted_at?: string | null
          org_id?: string
          payload?: Json
          status?: string
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_active: { Args: never; Returns: boolean }
    }
    Enums: {
      period_cadence: "weekly" | "biweekly" | "monthly"
      rate_type: "hourly" | "salaried" | "fixed"
      user_role: "superadmin" | "admin" | "employee"
      user_status: "pending" | "active" | "suspended"
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
    Enums: {
      period_cadence: ["weekly", "biweekly", "monthly"],
      rate_type: ["hourly", "salaried", "fixed"],
      user_role: ["superadmin", "admin", "employee"],
      user_status: ["pending", "active", "suspended"],
    },
  },
} as const

// ---------------------------------------------------------------------------
// Convenience aliases used throughout the app.
// ---------------------------------------------------------------------------

export type Organization = Tables<"organizations">
export type Profile = Tables<"profiles">
export type AuditLog = Tables<"audit_log">
export type Timesheet = Tables<"timesheets">
export type TimesheetRow = Tables<"timesheet_rows">
export type WebhookDelivery = Tables<"webhook_deliveries">

export type UserRole = Enums<"user_role">
export type UserStatus = Enums<"user_status">
export type RateType = Enums<"rate_type">
export type PeriodCadence = Enums<"period_cadence">

/** timesheets.status — a text column with a CHECK constraint (not a PG enum). */
export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected"
export const TIMESHEET_STATUSES: TimesheetStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
]

export const USER_ROLES = Constants.public.Enums.user_role
export const USER_STATUSES = Constants.public.Enums.user_status
export const RATE_TYPES = Constants.public.Enums.rate_type
export const PERIOD_CADENCES = Constants.public.Enums.period_cadence
