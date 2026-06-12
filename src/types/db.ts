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
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb_swift: string | null
          bank_name: string | null
          created_at: string
          currency: string
          email: string
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relation: string | null
          full_name: string | null
          id: string
          job_title: string | null
          onboarding_complete: boolean
          org_id: string | null
          payment_terms_days: number | null
          rate: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          role: Database["public"]["Enums"]["user_role"]
          start_date: string | null
          status: Database["public"]["Enums"]["user_status"]
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb_swift?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          email: string
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          onboarding_complete?: boolean
          org_id?: string | null
          payment_terms_days?: number | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          role?: Database["public"]["Enums"]["user_role"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb_swift?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          email?: string
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          onboarding_complete?: boolean
          org_id?: string | null
          payment_terms_days?: number | null
          rate?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          role?: Database["public"]["Enums"]["user_role"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          tax_id?: string | null
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
          has_overtime: boolean
          id: string
          org_id: string
          overtime_hours: number
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
          has_overtime?: boolean
          id?: string
          org_id: string
          overtime_hours?: number
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
          has_overtime?: boolean
          id?: string
          org_id?: string
          overtime_hours?: number
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
      documents: {
        Row: {
          created_at: string
          currency: string
          document_number: string
          emailed_at: string | null
          employee_id: string
          file_path: string | null
          generated_by: string | null
          gst_amount: number
          gst_enabled: boolean
          gst_rate: number | null
          id: string
          org_id: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          subtotal: number
          timesheet_id: string
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          document_number: string
          emailed_at?: string | null
          employee_id: string
          file_path?: string | null
          generated_by?: string | null
          gst_amount?: number
          gst_enabled?: boolean
          gst_rate?: number | null
          id?: string
          org_id: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          subtotal: number
          timesheet_id: string
          total: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          document_number?: string
          emailed_at?: string | null
          employee_id?: string
          file_path?: string | null
          generated_by?: string | null
          gst_amount?: number
          gst_enabled?: boolean
          gst_rate?: number | null
          id?: string
          org_id?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          subtotal?: number
          timesheet_id?: string | null
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
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
      notifications: {
        Row: {
          id: string
          org_id: string
          user_id: string
          type: string
          title: string
          body: string | null
          entity: string | null
          entity_id: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          type: string
          title: string
          body?: string | null
          entity?: string | null
          entity_id?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          entity?: string | null
          entity_id?: string | null
          read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          id: string
          org_id: string
          email: string
          role: Database["public"]["Enums"]["user_role"]
          invited_by: string
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role?: Database["public"]["Enums"]["user_role"]
          invited_by: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          role?: Database["public"]["Enums"]["user_role"]
          invited_by?: string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      leave_types: {
        Row: {
          category: string
          color: string | null
          created_at: string
          default_days_per_year: number | null
          id: string
          is_active: boolean
          name: string
          org_id: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          default_days_per_year?: number | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          default_days_per_year?: number | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          allocated_days: number
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          org_id: string
          pending_days: number
          used_days: number
          year: number
        }
        Insert: {
          allocated_days?: number
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          org_id: string
          pending_days?: number
          used_days?: number
          year: number
        }
        Update: {
          allocated_days?: number
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          org_id?: string
          pending_days?: number
          used_days?: number
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days_requested: number
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          leave_type_id: string
          note: string | null
          org_id: string
          rejection_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_requested: number
          employee_id: string
          end_date: string
          half_day?: boolean
          id?: string
          leave_type_id: string
          note?: string | null
          org_id: string
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_requested?: number
          employee_id?: string
          end_date?: string
          half_day?: boolean
          id?: string
          leave_type_id?: string
          note?: string | null
          org_id?: string
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          org_id: string
          step: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          org_id: string
          step: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          org_id?: string
          step?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          org_id: string
          owner_id: string | null
          name: string
          color: string
          is_org_wide: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          owner_id?: string | null
          name: string
          color?: string
          is_org_wide?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          owner_id?: string | null
          name?: string
          color?: string
          is_org_wide?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          timesheet_id: string | null
          project_id: string | null
          entry_date: string
          start_time: string
          end_time: string
          entry_mode: string
          decimal_hours: number | null
          is_overnight: boolean
          total_hours: number
          description: string | null
          billable: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          employee_id: string
          timesheet_id?: string | null
          project_id?: string | null
          entry_date: string
          start_time: string
          end_time: string
          entry_mode?: string
          decimal_hours?: number | null
          is_overnight?: boolean
          /** Generated column — omit on insert. */
          total_hours?: number
          description?: string | null
          billable?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          employee_id?: string
          timesheet_id?: string | null
          project_id?: string | null
          entry_date?: string
          start_time?: string
          end_time?: string
          entry_mode?: string
          decimal_hours?: number | null
          is_overnight?: boolean
          total_hours?: number
          description?: string | null
          billable?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      official_documents: {
        Row: {
          category: string
          created_at: string
          employee_id: string | null
          employee_note: string | null
          file_path: string
          file_type: string
          id: string
          name: string
          org_id: string
          signed_at: string | null
          signature_data: string | null
          signing_type: string
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category: string
          created_at?: string
          employee_id?: string | null
          employee_note?: string | null
          file_path: string
          file_type: string
          id?: string
          name: string
          org_id: string
          signed_at?: string | null
          signature_data?: string | null
          signing_type: string
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          employee_id?: string | null
          employee_note?: string | null
          file_path?: string
          file_type?: string
          id?: string
          name?: string
          org_id?: string
          signed_at?: string | null
          signature_data?: string | null
          signing_type?: string
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
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
      next_document_number: {
        Args: { p_org_id: string; p_type: string }
        Returns: string
      }
      approve_leave_request: {
        Args: { p_request_id: string; p_reviewer_id: string }
        Returns: undefined
      }
      reject_leave_request: {
        Args: {
          p_request_id: string
          p_reviewer_id: string
          p_note: string
        }
        Returns: undefined
      }
    }
    Enums: {
      period_cadence: "weekly" | "biweekly" | "monthly"
      rate_type: "hourly" | "salaried" | "fixed"
      user_role: "superadmin" | "owner" | "admin" | "employee"
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
      user_role: ["superadmin", "owner", "admin", "employee"],
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
export type Document = Tables<"documents">
export type Timesheet = Tables<"timesheets">
export type TimesheetRow = Tables<"timesheet_rows">
export type WebhookDelivery = Tables<"webhook_deliveries">
export type LeaveType = Tables<"leave_types">
export type LeaveBalance = Tables<"leave_balances">
export type LeaveRequest = Tables<"leave_requests">
export type OnboardingStep = Tables<"onboarding_steps">
export type OfficialDocument = Tables<"official_documents">
export type Notification = Tables<"notifications">
export type Project = Tables<"projects">
export type TimeEntry = Tables<"time_entries">
export type { TimeEntryWithProject } from "./time-tracking";

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

export type DocumentType = "pay_advice" | "invoice"
export type DocumentStatus =
  | "draft"
  | "in_progress"
  | "verified"
  | "corrections_needed"

export const USER_ROLES = Constants.public.Enums.user_role
export const USER_STATUSES = Constants.public.Enums.user_status
export const RATE_TYPES = Constants.public.Enums.rate_type
export const PERIOD_CADENCES = Constants.public.Enums.period_cadence

export type LeaveCategory =
  | "annual"
  | "sick"
  | "unpaid"
  | "public_holiday"
  | "custom"
export type LeaveRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
export type OnboardingStepName =
  | "personal"
  | "banking"
  | "employment"
  | "emergency"
  | "documents"
  | "complete"
export type OfficialDocCategory =
  | "contract"
  | "offer_letter"
  | "policy"
  | "nda"
  | "other"
export type OfficialDocStatus =
  | "pending"
  | "signed"
  | "acknowledged"
  | "rejected"
