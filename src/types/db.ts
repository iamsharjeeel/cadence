/**
 * Database types for Cadence.
 *
 * The `Database` interface mirrors the EXISTING Supabase schema (do not recreate
 * the schema — it already exists). Generated from the live project schema and
 * kept in sync manually. Regenerate with:
 *
 *   npx supabase gen types typescript --project-id <id> --schema public
 *
 * Convenience row/enum aliases live at the bottom of this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string | null;
          id: string;
          org_id: string | null;
          payload: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string | null;
          id?: string;
          org_id?: string | null;
          payload?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string | null;
          id?: string;
          org_id?: string | null;
          payload?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          allowed_domains: string[];
          base_currency: string;
          created_at: string;
          default_cadence: Database["public"]["Enums"]["period_cadence"];
          id: string;
          logo_url: string | null;
          name: string;
          slug: string;
        };
        Insert: {
          allowed_domains?: string[];
          base_currency?: string;
          created_at?: string;
          default_cadence?: Database["public"]["Enums"]["period_cadence"];
          id?: string;
          logo_url?: string | null;
          name: string;
          slug: string;
        };
        Update: {
          allowed_domains?: string[];
          base_currency?: string;
          created_at?: string;
          default_cadence?: Database["public"]["Enums"]["period_cadence"];
          id?: string;
          logo_url?: string | null;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          currency: string;
          email: string;
          full_name: string | null;
          id: string;
          org_id: string | null;
          rate: number | null;
          rate_type: Database["public"]["Enums"]["rate_type"];
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
        };
        Insert: {
          created_at?: string;
          currency?: string;
          email: string;
          full_name?: string | null;
          id: string;
          org_id?: string | null;
          rate?: number | null;
          rate_type?: Database["public"]["Enums"]["rate_type"];
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
        };
        Update: {
          created_at?: string;
          currency?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          org_id?: string | null;
          rate?: number | null;
          rate_type?: Database["public"]["Enums"]["rate_type"];
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_org: { Args: Record<string, never>; Returns: string };
      auth_role: {
        Args: Record<string, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_active: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      period_cadence: "weekly" | "biweekly" | "monthly";
      rate_type: "hourly" | "salaried" | "fixed";
      user_role: "superadmin" | "admin" | "employee";
      user_status: "pending" | "active" | "suspended";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---------------------------------------------------------------------------
// Convenience aliases used throughout the app.
// ---------------------------------------------------------------------------

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type Organization = Tables<"organizations">;
export type Profile = Tables<"profiles">;
export type AuditLog = Tables<"audit_log">;

export type UserRole = Enums<"user_role">;
export type UserStatus = Enums<"user_status">;
export type RateType = Enums<"rate_type">;
export type PeriodCadence = Enums<"period_cadence">;

export const USER_ROLES: UserRole[] = ["superadmin", "admin", "employee"];
export const USER_STATUSES: UserStatus[] = ["pending", "active", "suspended"];
export const RATE_TYPES: RateType[] = ["hourly", "salaried", "fixed"];
export const PERIOD_CADENCES: PeriodCadence[] = [
  "weekly",
  "biweekly",
  "monthly",
];
