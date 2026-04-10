/**
 * TypeScript types for the Ida Designer database schema.
 *
 * These mirror the tables defined in supabase/migrations/.
 * When you change the schema, update this file too — or better, use the
 * Supabase CLI to auto-generate it: `npx supabase gen types typescript`
 *
 * Usage:
 *   import type { Database } from "@/types/database"
 *   import type { Tables } from "@/types/database"   // shorthand for rows
 */

// ── JSON type (used for jsonb columns) ────────────────────────────────────
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Custom enum types ──────────────────────────────────────────────────────

export type PlatformRole = "super_admin" | "studio_member";
export type StudioMemberRole = "owner" | "admin" | "designer" | "viewer";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type HotspotType = "drawing_link" | "spec_pin";
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "url"
  | "select"
  | "boolean";
export type SpecStatus =
  | "draft"
  | "specified"
  | "approved"
  | "ordered"
  | "delivered";

// ── Row types — what you get back when you SELECT from a table ─────────────

export type ProfileRow = {
  id: string; // uuid — matches auth.users.id
  first_name: string | null;
  last_name: string | null;
  platform_role: PlatformRole;
  created_at: string;
  updated_at: string;
};

export type StudioRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
};

export type StudioMemberRow = {
  id: string;
  studio_id: string;
  user_id: string | null;       // null = pending (not yet invited/signed up)
  role: StudioMemberRole;
  studio_role_id: string | null; // FK → studio_roles.id (configurable job title)
  email: string | null;         // stored for pending members (no auth account yet)
  first_name: string | null;    // stored for pending members
  last_name: string | null;     // stored for pending members
  created_at: string;
};

export type StudioRoleRow = {
  id: string;
  studio_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type ClientRow = {
  id: string;
  studio_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  studio_id: string;
  client_id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  site_address: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  client_id: string;
  studio_id: string;
  first_name: string;
  last_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type DrawingRow = {
  id: string;
  project_id: string;
  name: string;
  file_url: string | null;
  file_path: string | null;
  category: string | null;
  order_index: number;
  canvas_width: number | null;
  canvas_height: number | null;
  created_at: string;
  updated_at: string;
};

export type DrawingHotspotRow = {
  id: string;
  drawing_id: string;
  hotspot_type: HotspotType;
  target_drawing_id: string | null;
  project_spec_id: string | null;
  x: number;
  y: number;
  label: string | null;
  created_at: string;
};

export type SpecTemplateRow = {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SpecTemplateFieldRow = {
  id: string;
  template_id: string;
  name: string;
  field_type: FieldType;
  options: string[] | null; // jsonb — array of strings for 'select' type
  is_required: boolean;
  order_index: number;
  ai_hint: string | null;
  created_at: string;
};

export type SpecRow = {
  id: string;
  studio_id: string;
  template_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  created_at: string;
  updated_at: string;
};

// ── CRM / Contacts ────────────────────────────────────────────────────────────

export type ContactCategoryRow = {
  id: string;
  studio_id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type ContactCompanyRow = {
  id: string;
  studio_id: string;
  category_id: string | null;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactPersonRow = {
  id: string;
  company_id: string;
  studio_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactTagRow = {
  company_id: string;
  tag: string;
};

export type SpecCategoryRow = {
  id: string;
  studio_id: string;
  parent_id: string | null;
  name: string;
  abbreviation: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  template_id: string | null;
  created_at: string;
};

export type SpecTagRow = {
  spec_id: string;
  tag: string;
};

export type SpecSupplierRow = {
  spec_id: string;
  supplier_id: string; // references contact_companies.id
  supplier_code: string | null;
  unit_cost: number | null;
};

export type SpecFieldValueRow = {
  id: string;
  spec_id: string;
  template_field_id: string;
  value: string | null;
  created_at: string;
};

export type ProjectSpecRow = {
  id: string;
  project_id: string;
  spec_id: string;
  drawing_id: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  status: SpecStatus;
  created_at: string;
  updated_at: string;
};

export type UserProjectStarRow = {
  user_id: string;
  project_id: string;
};

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  studio_member_id: string;
  created_at: string;
};

// ── Insert types — what you pass when creating a new row ──────────────────
// (omit id, created_at, updated_at — Postgres generates these)
//
// Insertable<T> mirrors what `supabase gen types typescript` generates:
// nullable columns have a database-level NULL default, so they don't need
// to be supplied in INSERT payloads. Non-nullable columns remain required.
type Insertable<T> = {
  [K in keyof T as null extends T[K] ? K : never]?: T[K];
} & {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
};

export type ProfileInsert = Omit<ProfileRow, "created_at" | "updated_at">;
export type StudioInsert = Omit<StudioRow, "id" | "created_at" | "updated_at">;
export type StudioMemberInsert = Insertable<Omit<StudioMemberRow, "id" | "created_at">>;
export type StudioRoleInsert = Insertable<Omit<StudioRoleRow, "id" | "created_at">>;
export type ProjectMemberInsert = Omit<ProjectMemberRow, "id" | "created_at">;
export type ClientInsert = Insertable<Omit<ClientRow, "id" | "created_at" | "updated_at">>;
export type ProjectInsert = Insertable<Omit<ProjectRow, "id" | "created_at" | "updated_at">>;
export type ContactInsert = Insertable<Omit<ContactRow, "id" | "created_at" | "updated_at">>;
export type DrawingInsert = Insertable<Omit<DrawingRow, "id" | "created_at" | "updated_at">>;
export type DrawingHotspotInsert = Insertable<Omit<DrawingHotspotRow, "id" | "created_at">>;
export type SpecTemplateInsert = Insertable<Omit<SpecTemplateRow, "id" | "created_at" | "updated_at">>;
export type SpecTemplateFieldInsert = Insertable<Omit<SpecTemplateFieldRow, "id" | "created_at">>;
export type SpecInsert = Insertable<Omit<SpecRow, "id" | "created_at" | "updated_at">>;
export type SpecFieldValueInsert = Insertable<Omit<SpecFieldValueRow, "id" | "created_at">>;
export type SpecCategoryInsert = Insertable<Omit<SpecCategoryRow, "id" | "created_at">>;
export type SpecSupplierInsert = SpecSupplierRow;
export type ProjectSpecInsert = Insertable<Omit<ProjectSpecRow, "id" | "created_at" | "updated_at">>;
export type ContactCategoryInsert = Insertable<Omit<ContactCategoryRow, "id" | "created_at">>;
export type ContactCompanyInsert = Insertable<Omit<ContactCompanyRow, "id" | "created_at" | "updated_at">>;
export type ContactPersonInsert = Insertable<Omit<ContactPersonRow, "id" | "created_at" | "updated_at">>;

// ── Database type — used to type the Supabase client ─────────────────────
// This follows the shape that `supabase gen types typescript` would produce.
// It's simplified here — run the CLI command for a fully typed version once
// you have a live Supabase project.

// Shared empty Relationships array (required by Supabase JS SDK v2.102+ GenericTable contract)
type EmptyRelationships = [];

export type Database = {
  // Required by Supabase JS SDK v2.102+ for correct Insert/Update type inference
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: EmptyRelationships;
      };
      studios: {
        Row: StudioRow;
        Insert: StudioInsert;
        Update: Partial<StudioInsert>;
        Relationships: EmptyRelationships;
      };
      studio_members: {
        Row: StudioMemberRow;
        Insert: StudioMemberInsert;
        Update: Partial<StudioMemberInsert>;
        Relationships: EmptyRelationships;
      };
      studio_roles: {
        Row: StudioRoleRow;
        Insert: StudioRoleInsert;
        Update: Partial<StudioRoleInsert>;
        Relationships: EmptyRelationships;
      };
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: Partial<Omit<ClientRow, "id" | "created_at">>;
        Relationships: EmptyRelationships;
      };
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: Partial<ProjectInsert>;
        Relationships: EmptyRelationships;
      };
      drawings: {
        Row: DrawingRow;
        Insert: DrawingInsert;
        Update: Partial<DrawingInsert>;
        Relationships: EmptyRelationships;
      };
      drawing_hotspots: {
        Row: DrawingHotspotRow;
        Insert: DrawingHotspotInsert;
        Update: Partial<DrawingHotspotInsert>;
        Relationships: EmptyRelationships;
      };
      spec_templates: {
        Row: SpecTemplateRow;
        Insert: SpecTemplateInsert;
        Update: Partial<SpecTemplateInsert>;
        Relationships: EmptyRelationships;
      };
      spec_template_fields: {
        Row: SpecTemplateFieldRow;
        Insert: SpecTemplateFieldInsert;
        Update: Partial<SpecTemplateFieldInsert>;
        Relationships: EmptyRelationships;
      };
      specs: {
        Row: SpecRow;
        Insert: SpecInsert;
        Update: Partial<SpecInsert>;
        Relationships: EmptyRelationships;
      };
      spec_field_values: {
        Row: SpecFieldValueRow;
        Insert: SpecFieldValueInsert;
        Update: Partial<SpecFieldValueInsert>;
        Relationships: EmptyRelationships;
      };
      project_specs: {
        Row: ProjectSpecRow;
        Insert: ProjectSpecInsert;
        Update: Partial<ProjectSpecInsert>;
        Relationships: EmptyRelationships;
      };
      contact_categories: {
        Row: ContactCategoryRow;
        Insert: ContactCategoryInsert;
        Update: Partial<ContactCategoryInsert>;
        Relationships: EmptyRelationships;
      };
      contact_companies: {
        Row: ContactCompanyRow;
        Insert: ContactCompanyInsert;
        Update: Partial<ContactCompanyInsert>;
        Relationships: EmptyRelationships;
      };
      contact_people: {
        Row: ContactPersonRow;
        Insert: ContactPersonInsert;
        Update: Partial<ContactPersonInsert>;
        Relationships: EmptyRelationships;
      };
      contact_tags: {
        Row: ContactTagRow;
        Insert: ContactTagRow;
        Update: Partial<ContactTagRow>;
        Relationships: EmptyRelationships;
      };
      spec_categories: {
        Row: SpecCategoryRow;
        Insert: SpecCategoryInsert;
        Update: Partial<SpecCategoryInsert>;
        Relationships: EmptyRelationships;
      };
      spec_tags: {
        Row: SpecTagRow;
        Insert: SpecTagRow;
        Update: Partial<SpecTagRow>;
        Relationships: EmptyRelationships;
      };
      spec_suppliers: {
        Row: SpecSupplierRow;
        Insert: SpecSupplierInsert;
        Update: Partial<SpecSupplierInsert>;
        Relationships: EmptyRelationships;
      };
      contacts: {
        Row: ContactRow;
        Insert: ContactInsert;
        Update: Partial<Omit<ContactRow, "id" | "created_at">>;
        Relationships: EmptyRelationships;
      };
      user_project_stars: {
        Row: UserProjectStarRow;
        Insert: UserProjectStarRow;
        Update: Partial<UserProjectStarRow>;
        Relationships: EmptyRelationships;
      };
      project_members: {
        Row: ProjectMemberRow;
        Insert: ProjectMemberInsert;
        Update: Partial<ProjectMemberInsert>;
        Relationships: EmptyRelationships;
      };
    };
    Views: Record<string, never>;
    Functions: {
      seed_default_contact_categories: {
        Args: { p_studio_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      platform_role: PlatformRole;
      studio_member_role: StudioMemberRole;
      subscription_status: SubscriptionStatus;
      project_status: ProjectStatus;
      hotspot_type: HotspotType;
      field_type: FieldType;
      spec_status: SpecStatus;
    };
  };
};

// Convenience shorthand: Tables<"profiles"> gives you ProfileRow, etc.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
