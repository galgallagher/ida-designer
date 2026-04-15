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
// Drawing type — the three drawing categories used in design schedules (migration 029)
export type DrawingType = "arch_id" | "joinery" | "ffe";
// System-defined schedule type keys — the built-in schedule classifications.
// After migration 034, item_type columns are text so custom studio schedules
// (keyed by UUID) are also valid values. Use SystemSpecItemType where you
// need exhaustive matching against known values only.
export type SystemSpecItemType =
  | "ffe"
  | "ironmongery"
  | "sanitaryware"
  | "joinery"
  | "arch_id_finishes"
  | "joinery_finishes"
  | "ffe_finishes";

// SpecItemType allows both system keys and custom UUID keys.
// The (string & {}) intersection prevents TypeScript collapsing this to plain
// string, preserving autocomplete on the known system values.
export type SpecItemType = SystemSpecItemType | (string & {});

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
  project_id: string;                 // LEGACY — kept during transition; drop in migration 033
  project_option_id: string | null;   // new (migration 031)
  studio_id: string | null;           // new (migration 031) — denormalised for RLS
  drawing_type: DrawingType | null;   // new (migration 031)
  name: string;
  file_url: string | null;
  file_path: string | null;
  category: string | null;            // LEGACY free-text; drawing_type replaces this
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
  code: string | null;             // product/reference code e.g. "8086/02" (migration 035)
  variant_group_id: string | null; // shared UUID for colorway siblings (migration 036)
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  source_url: string | null;
  global_spec_id: string | null;  // FK to global_specs (migration 026)
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
  project_id: string;                  // LEGACY — kept during transition; drop in migration 033
  project_option_id: string | null;    // new (migration 032)
  studio_id: string | null;            // new (migration 032) — denormalised for RLS
  spec_id: string;
  drawing_id: string | null;
  item_type: string | null;            // text after migration 034 (was spec_item_type enum)
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

// ── Global library (migration 025) ────────────────────────────────────────────

export type GlobalSpecRow = {
  id: string;
  source_url: string;     // UTM-stripped canonical URL — unique dedup key
  name: string;
  code: string | null;    // product/reference code (migration 035)
  brand_name: string | null;
  brand_domain: string | null;  // e.g. "johnlewis.com" (no www)
  description: string | null;
  image_url: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  category_hint: string | null;
  scraped_at: string;
  updated_at: string;
};

export type GlobalSpecFieldRow = {
  id: string;
  global_spec_id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type GlobalSpecTagRow = {
  global_spec_id: string;
  tag: string;
};

// ── Project Options (migration 027) ───────────────────────────────────────────

export type ProjectOptionRow = {
  id: string;
  studio_id: string;
  project_id: string;
  name: string;
  label: string;          // char(1): "A", "B", "C"
  description: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

// ── Studio Finishes (migration 028) ───────────────────────────────────────────

export type StudioFinishRow = {
  id: string;
  studio_id: string;
  code: string;           // e.g. "WD-01", "FB-03", "MT-07"
  name: string;           // e.g. "White Oak Veneer"
  description: string | null;
  colour_hex: string | null;   // e.g. "#C4A882" — UI swatch
  image_url: string | null;
  image_path: string | null;
  global_spec_id: string | null;  // optional FK to Global Material Library
  created_at: string;
  updated_at: string;
};

// ── Studio Materials — Finishes Library (migration 035) ──────────────────────
// One row per material per studio. Seeded from seed_default_studio_materials().
// Distinct from StudioFinishRow (migration 028) which is for drawing finish codes.

export type MaterialCategory = 'wood' | 'stone' | 'metal' | 'glass' | 'concrete';

export const MATERIAL_CATEGORIES: { key: MaterialCategory; label: string }[] = [
  { key: 'wood',     label: 'Wood'               },
  { key: 'stone',    label: 'Stone & Marble'      },
  { key: 'metal',    label: 'Metal'               },
  { key: 'glass',    label: 'Glass'               },
  { key: 'concrete', label: 'Concrete & Plaster'  },
];

export type StudioMaterialRow = {
  id: string;
  studio_id: string;
  category: MaterialCategory;
  name: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;   // storage path for deletion
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ── Drawing Finishes junction (migration 029) ─────────────────────────────────

export type DrawingFinishRow = {
  drawing_id: string;
  studio_finish_id: string;
  studio_id: string;
  order_index: number;
  notes: string | null;
  created_at: string;
};

// ── Studio Spec Preferences (migration 030) ───────────────────────────────────

export type StudioSpecPreferenceRow = {
  id: string;
  studio_id: string;
  item_type: string;             // text after migration 034 (was spec_item_type enum)
  is_visible: boolean;
  display_name: string | null;   // optional label override (or name for custom schedules)
  sort_order: number;
  is_custom: boolean;            // true = studio-created; false = system default (migration 034)
  created_at: string;
  updated_at: string;
};

// ── Project Schedule Preferences (migration 037) ──────────────────────────────
// Per-project schedule config. Falls back to studio_spec_preferences when empty.

export type ProjectSchedulePreferenceRow = {
  id: string;
  project_id: string;
  studio_id: string;
  item_type: string;
  display_name: string | null;
  is_visible: boolean;
  is_custom: boolean;
  sort_order: number;
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
export type StudioMaterialInsert = Insertable<Omit<StudioMaterialRow, "id" | "created_at" | "updated_at">>;
export type ContactCategoryInsert = Insertable<Omit<ContactCategoryRow, "id" | "created_at">>;
export type ContactCompanyInsert = Insertable<Omit<ContactCompanyRow, "id" | "created_at" | "updated_at">>;
export type ContactPersonInsert = Insertable<Omit<ContactPersonRow, "id" | "created_at" | "updated_at">>;
export type GlobalSpecInsert = Insertable<Omit<GlobalSpecRow, "id" | "scraped_at" | "updated_at">>;
export type GlobalSpecFieldInsert = Insertable<Omit<GlobalSpecFieldRow, "id">>;
export type GlobalSpecTagInsert = GlobalSpecTagRow;
export type ProjectOptionInsert = Insertable<Omit<ProjectOptionRow, "id" | "created_at" | "updated_at">>;
export type StudioFinishInsert = Insertable<Omit<StudioFinishRow, "id" | "created_at" | "updated_at">>;
// DrawingFinishRow has a composite PK — both columns are required on insert
export type DrawingFinishInsert = Omit<DrawingFinishRow, "created_at">;
export type StudioSpecPreferenceInsert = Insertable<Omit<StudioSpecPreferenceRow, "id" | "created_at" | "updated_at">>;

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
      global_specs: {
        Row: GlobalSpecRow;
        Insert: GlobalSpecInsert;
        Update: Partial<GlobalSpecInsert>;
        Relationships: EmptyRelationships;
      };
      global_spec_fields: {
        Row: GlobalSpecFieldRow;
        Insert: GlobalSpecFieldInsert;
        Update: Partial<GlobalSpecFieldInsert>;
        Relationships: EmptyRelationships;
      };
      global_spec_tags: {
        Row: GlobalSpecTagRow;
        Insert: GlobalSpecTagInsert;
        Update: Partial<GlobalSpecTagInsert>;
        Relationships: EmptyRelationships;
      };
      project_options: {
        Row: ProjectOptionRow;
        Insert: ProjectOptionInsert;
        Update: Partial<ProjectOptionInsert>;
        Relationships: EmptyRelationships;
      };
      studio_finishes: {
        Row: StudioFinishRow;
        Insert: StudioFinishInsert;
        Update: Partial<StudioFinishInsert>;
        Relationships: EmptyRelationships;
      };
      drawing_finishes: {
        Row: DrawingFinishRow;
        Insert: DrawingFinishInsert;
        Update: Partial<Omit<DrawingFinishRow, "drawing_id" | "studio_finish_id">>;
        Relationships: EmptyRelationships;
      };
      studio_spec_preferences: {
        Row: StudioSpecPreferenceRow;
        Insert: StudioSpecPreferenceInsert;
        Update: Partial<StudioSpecPreferenceInsert>;
        Relationships: EmptyRelationships;
      };
      studio_materials: {
        Row: StudioMaterialRow;
        Insert: StudioMaterialInsert;
        Update: Partial<StudioMaterialInsert>;
        Relationships: EmptyRelationships;
      };
      project_schedule_preferences: {
        Row: ProjectSchedulePreferenceRow;
        Insert: Omit<ProjectSchedulePreferenceRow, "id" | "created_at">;
        Update: Partial<Omit<ProjectSchedulePreferenceRow, "id" | "created_at" | "project_id" | "studio_id">>;
        Relationships: EmptyRelationships;
      };
    };
    Views: Record<string, never>;
    Functions: {
      seed_default_contact_categories: {
        Args: { p_studio_id: string };
        Returns: undefined;
      };
      seed_default_studio_materials: {
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
      drawing_type: DrawingType;
      spec_item_type: SpecItemType;
    };
  };
};

// Convenience shorthand: Tables<"profiles"> gives you ProfileRow, etc.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
