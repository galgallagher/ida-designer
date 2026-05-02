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

// ── Library — formerly "Specs" (renamed in migration 054, see ADR 031) ──────
// A library item is the studio's curated entry. Two modes:
//   - product_library_id IS NOT NULL → sourced product. Read canonical data
//     from product_library, fall back to *_override columns here.
//   - product_library_id IS NULL → finish. Data lives directly on this row.

export type LibraryTemplateRow = {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LibraryTemplateFieldRow = {
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

export type LibraryItemRow = {
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
  product_library_id: string | null;
  cost_from: number | null;
  cost_to: number | null;
  cost_unit: string | null;
  // Override columns — only meaningful when product_library_id IS NOT NULL.
  // NULL = use canonical from product_library; SET = use studio's local value.
  name_override: string | null;
  description_override: string | null;
  image_url_override: string | null;
  image_path_override: string | null;
  cost_from_override: number | null;
  cost_to_override: number | null;
  cost_unit_override: string | null;
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

export type LibraryCategoryRow = {
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

export type LibraryItemTagRow = {
  library_item_id: string;
  tag: string;
};

export type LibraryItemSupplierRow = {
  library_item_id: string;
  supplier_id: string;
  supplier_code: string | null;
  unit_cost: number | null;
};

export type LibraryItemFieldValueRow = {
  id: string;
  library_item_id: string;
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
  library_item_id: string | null;
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
  library_item_id: string | null;
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

// ── Product Library — formerly "Global Specs" (renamed in migration 054) ────
// Canonical product catalogue. One row per unique product (URL-deduplicated).
// Cross-studio readable; service-role only writes.

export type ProductLibraryRow = {
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

export type ProductLibraryFieldRow = {
  id: string;
  product_library_id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type ProductLibraryTagRow = {
  product_library_id: string;
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
export type LibraryTemplateInsert = Insertable<Omit<LibraryTemplateRow, "id" | "created_at" | "updated_at">>;
export type LibraryTemplateFieldInsert = Insertable<Omit<LibraryTemplateFieldRow, "id" | "created_at">>;
export type LibraryItemInsert = Insertable<Omit<LibraryItemRow, "id" | "created_at" | "updated_at">>;
export type LibraryItemFieldValueInsert = Insertable<Omit<LibraryItemFieldValueRow, "id" | "created_at">>;
export type LibraryCategoryInsert = Insertable<Omit<LibraryCategoryRow, "id" | "created_at">>;
export type LibraryItemSupplierInsert = LibraryItemSupplierRow;
export type ProjectOptionInsert = Insertable<Omit<ProjectOptionRow, "id" | "created_at" | "updated_at">>;
export type StudioMaterialInsert = Insertable<Omit<StudioMaterialRow, "id" | "created_at" | "updated_at">>;
export type DefaultFinishInsert = Insertable<Omit<DefaultFinishRow, "id" | "created_at" | "updated_at">>;
export type ContactCategoryInsert = Insertable<Omit<ContactCategoryRow, "id" | "created_at">>;
export type ContactCompanyInsert = Insertable<Omit<ContactCompanyRow, "id" | "created_at" | "updated_at">>;
export type ContactPersonInsert = Insertable<Omit<ContactPersonRow, "id" | "created_at" | "updated_at">>;
export type ProductLibraryInsert = Insertable<Omit<ProductLibraryRow, "id" | "scraped_at" | "updated_at">>;
export type ProductLibraryFieldInsert = Insertable<Omit<ProductLibraryFieldRow, "id">>;
export type ProductLibraryTagInsert = ProductLibraryTagRow;
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
      library_templates: {
        Row: LibraryTemplateRow;
        Insert: LibraryTemplateInsert;
        Update: Partial<LibraryTemplateInsert>;
        Relationships: EmptyRelationships;
      };
      library_template_fields: {
        Row: LibraryTemplateFieldRow;
        Insert: LibraryTemplateFieldInsert;
        Update: Partial<LibraryTemplateFieldInsert>;
        Relationships: EmptyRelationships;
      };
      library_items: {
        Row: LibraryItemRow;
        Insert: LibraryItemInsert;
        Update: Partial<LibraryItemInsert>;
        Relationships: EmptyRelationships;
      };
      library_item_field_values: {
        Row: LibraryItemFieldValueRow;
        Insert: LibraryItemFieldValueInsert;
        Update: Partial<LibraryItemFieldValueInsert>;
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
      library_categories: {
        Row: LibraryCategoryRow;
        Insert: LibraryCategoryInsert;
        Update: Partial<LibraryCategoryInsert>;
        Relationships: EmptyRelationships;
      };
      library_item_tags: {
        Row: LibraryItemTagRow;
        Insert: LibraryItemTagRow;
        Update: Partial<LibraryItemTagRow>;
        Relationships: EmptyRelationships;
      };
      library_item_suppliers: {
        Row: LibraryItemSupplierRow;
        Insert: LibraryItemSupplierInsert;
        Update: Partial<LibraryItemSupplierInsert>;
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
      product_library: {
        Row: ProductLibraryRow;
        Insert: ProductLibraryInsert;
        Update: Partial<ProductLibraryInsert>;
        Relationships: EmptyRelationships;
      };
      product_library_fields: {
        Row: ProductLibraryFieldRow;
        Insert: ProductLibraryFieldInsert;
        Update: Partial<ProductLibraryFieldInsert>;
        Relationships: EmptyRelationships;
      };
      product_library_tags: {
        Row: ProductLibraryTagRow;
        Insert: ProductLibraryTagInsert;
        Update: Partial<ProductLibraryTagInsert>;
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
      seed_default_library_categories: {
        Args: { p_studio_id: string };
        Returns: undefined;
      };
      seed_default_library_templates: {
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
