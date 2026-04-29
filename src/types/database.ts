/**
 * TypeScript types for the Ida Designer database schema.
 *
 * These mirror the tables defined in supabase/migrations/.
 * When you change the schema, update this file too.
 */

// ── JSON type (used for jsonb columns) ────────────────────────────────────
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Custom enum types ──────────────────────────────────────────────────────

export type PlatformRole = "super_admin" | "studio_member";
export type StudioMemberRole = "owner" | "admin" | "designer" | "viewer";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
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
  id: string;
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
  user_id: string | null;
  role: StudioMemberRole;
  studio_role_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
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
  currency: string;
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
  options: string[] | null;
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
  code: string | null;
  variant_group_id: string | null;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  source_url: string | null;
  global_spec_id: string | null;
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
  supplier_id: string;
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

// ── Project Options (migration 042, renamed from project_specs) ───────────────
// One row per spec added to a project. The spec comes from the studio library.

export type ProjectOptionRow = {
  id: string;
  project_id: string;
  studio_id: string | null;
  spec_id: string | null;
  drawing_id: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  status: SpecStatus;
  created_at: string;
  updated_at: string;
};

// ── Project Specs (migration 045) ─────────────────────────────────────────────
// The committed schedule. Auto-generated code (e.g. "FB1") + qty + project
// price + optional assignment to a library spec. Slots can be empty.

export type ProjectSpecRow = {
  id: string;
  project_id: string;
  studio_id: string;
  category_id: string;
  code: string;
  sequence: number;
  quantity: number;
  price: number | null;
  budget: number | null;
  effective_unit_cost: number | null;
  is_budgeted: boolean;
  spec_id: string | null;
  notes: string | null;
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

// ── Global library ─────────────────────────────────────────────────────────────

export type GlobalSpecRow = {
  id: string;
  source_url: string;
  name: string;
  code: string | null;
  brand_name: string | null;
  brand_domain: string | null;
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

// ── Studio Materials — Finishes/Materials Library ─────────────────────────────

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
  image_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DefaultFinishRow = {
  id: string;
  category: MaterialCategory;
  name: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ── Project Images ────────────────────────────────────────────────────────────

export type ProjectImageType = "inspiration" | "sketch";

export type ProjectImageRow = {
  id: string;
  project_id: string;
  studio_id: string;
  canvas_id: string | null;
  storage_path: string;
  url: string;
  type: ProjectImageType;
  created_at: string;
};

// ── Project Canvases ──────────────────────────────────────────────────────────

export type ProjectCanvasRow = {
  id: string;
  studio_id: string;
  project_id: string;
  name: string;
  content: Json;
  thumbnail_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

// ── Studio Models (3D Studio) ─────────────────────────────────────────────────

export type StudioModelFormat = "glb" | "gltf" | "obj" | "fbx";

export type StudioModelRow = {
  id: string;
  studio_id: string;
  project_id: string;
  name: string;
  file_path: string;
  format: StudioModelFormat;
  material_assignments: Json; // { [meshName: string]: specId }
  mesh_labels: Json;          // { [originalMeshName: string]: displayName }
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

// ── Insert types ──────────────────────────────────────────────────────────────

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
export type ProjectInsert = Insertable<Omit<ProjectRow, "id" | "created_at" | "updated_at" | "currency">> & { currency?: string };
export type ContactInsert = Insertable<Omit<ContactRow, "id" | "created_at" | "updated_at">>;
export type SpecTemplateInsert = Insertable<Omit<SpecTemplateRow, "id" | "created_at" | "updated_at">>;
export type SpecTemplateFieldInsert = Insertable<Omit<SpecTemplateFieldRow, "id" | "created_at">>;
export type SpecInsert = Insertable<Omit<SpecRow, "id" | "created_at" | "updated_at">>;
export type SpecFieldValueInsert = Insertable<Omit<SpecFieldValueRow, "id" | "created_at">>;
export type SpecCategoryInsert = Insertable<Omit<SpecCategoryRow, "id" | "created_at">>;
export type SpecSupplierInsert = SpecSupplierRow;
export type ProjectOptionInsert = Insertable<Omit<ProjectOptionRow, "id" | "created_at" | "updated_at">>;
export type StudioMaterialInsert = Insertable<Omit<StudioMaterialRow, "id" | "created_at" | "updated_at">>;
export type DefaultFinishInsert = Insertable<Omit<DefaultFinishRow, "id" | "created_at" | "updated_at">>;
export type ContactCategoryInsert = Insertable<Omit<ContactCategoryRow, "id" | "created_at">>;
export type ContactCompanyInsert = Insertable<Omit<ContactCompanyRow, "id" | "created_at" | "updated_at">>;
export type ContactPersonInsert = Insertable<Omit<ContactPersonRow, "id" | "created_at" | "updated_at">>;
export type GlobalSpecInsert = Insertable<Omit<GlobalSpecRow, "id" | "scraped_at" | "updated_at">>;
export type GlobalSpecFieldInsert = Insertable<Omit<GlobalSpecFieldRow, "id">>;
export type GlobalSpecTagInsert = GlobalSpecTagRow;
export type ProjectCanvasInsert = Insertable<Omit<ProjectCanvasRow, "id" | "created_at" | "updated_at">>;
export type ProjectImageInsert = Insertable<Omit<ProjectImageRow, "id" | "created_at">>;
export type ProjectSpecInsert = Insertable<Omit<ProjectSpecRow, "id" | "created_at" | "updated_at" | "effective_unit_cost" | "is_budgeted">>;
export type StudioModelInsert = Insertable<Omit<StudioModelRow, "created_at" | "updated_at">> & { id?: string };

// ── Database type — used to type the Supabase client ─────────────────────────

type EmptyRelationships = [];

export type Database = {
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
      project_options: {
        Row: ProjectOptionRow;
        Insert: ProjectOptionInsert;
        Update: Partial<ProjectOptionInsert>;
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
      studio_materials: {
        Row: StudioMaterialRow;
        Insert: StudioMaterialInsert;
        Update: Partial<StudioMaterialInsert>;
        Relationships: EmptyRelationships;
      };
      project_canvases: {
        Row: ProjectCanvasRow;
        Insert: ProjectCanvasInsert;
        Update: Partial<Omit<ProjectCanvasRow, "id" | "created_at">>;
        Relationships: EmptyRelationships;
      };
      project_images: {
        Row: ProjectImageRow;
        Insert: ProjectImageInsert;
        Update: Partial<Omit<ProjectImageRow, "id" | "created_at">>;
        Relationships: EmptyRelationships;
      };
      studio_models: {
        Row: StudioModelRow;
        Insert: StudioModelInsert;
        Update: Partial<Omit<StudioModelRow, "id" | "created_at">>;
        Relationships: EmptyRelationships;
      };
      default_finishes: {
        Row: DefaultFinishRow;
        Insert: DefaultFinishInsert;
        Update: Partial<Omit<DefaultFinishRow, "id" | "created_at">>;
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
      field_type: FieldType;
      spec_status: SpecStatus;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
