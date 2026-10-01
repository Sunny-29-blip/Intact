export type UserRole = "tenant" | "owner";
export type InspectionKind = "move_in" | "move_out";
export type ComparisonStatus = "pending" | "complete" | "failed";
export type FindingClassification = "damage" | "wear" | "unclear";
export type FindingSeverity = "minor" | "moderate" | "major";
export type FindingDecision = "pending" | "accepted" | "disputed";
export type IssueType =
  | "scratch"
  | "crack"
  | "stain"
  | "hole"
  | "missing_item"
  | "mark"
  | "other";
export type DocumentKind = "property_evidence" | "tenancy_contract";

export interface Document {
  id: string;
  user_id: string;
  kind: DocumentKind;
  owner_property_id: string | null;
  property_id: string | null;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  created_at: string;
}

export interface Profile {
  user_id: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
  email?: string;
}

export interface OwnerProperty {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  city: string | null;
  owner_name?: string | null;
  join_code: string;
  created_at: string;
  linked_tenants_count?: number;
  documents_count?: number;
  documents_missing?: boolean;
}

export interface TenancyLink {
  id: string;
  owner_property_id: string;
  tenant_id: string;
  tenant_property_id: string;
  shared: boolean;
  created_at: string;
}

export interface OwnerLinkedTenant {
  link_id: string;
  tenant_id: string;
  display_name: string;
  linked_at: string;
  shared: boolean;
  report_token?: string | null;
  tenant_property_name?: string;
}

export interface OwnerPropertyDetail extends OwnerProperty {
  linked_tenants: OwnerLinkedTenant[];
  documents: Document[];
}

export interface TenantLinkedOwnerProperty {
  link_id: string;
  owner_property_id: string;
  tenant_property_id: string;
  name: string;
  address: string | null;
  city: string | null;
  shared: boolean;
  linked_at: string;
}

export interface Property {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  tenant_name?: string | null;
  tenancy_start: string; // ISO Date YYYY-MM-DD
  tenancy_end: string | null;
  lease_notes: string | null;
  share_token: string;
  is_quick_check?: boolean;
  created_at: string;
  documents_missing?: boolean;
  contract?: Document | null;
}

export interface Inspection {
  id: string;
  user_id: string;
  property_id: string;
  kind: InspectionKind;
  created_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  inspection_id: string;
  area: string;
  storage_path: string;
  sha256: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PhotoWithUrl extends Photo {
  signed_url?: string;
}

export interface Comparison {
  id: string;
  user_id: string;
  property_id: string;
  area: string;
  move_in_photo_id: string | null;
  move_out_photo_id: string | null;
  status: ComparisonStatus;
  error: string | null;
  created_at: string;
}

export interface Finding {
  id: string;
  user_id: string;
  comparison_id: string;
  description: string;
  classification: FindingClassification;
  severity: FindingSeverity;
  issue_type?: IssueType | null;
  confidence: number;
  box_ymin: number | null;
  box_xmin: number | null;
  box_ymax: number | null;
  box_xmax: number | null;
  reasoning: string | null;
  decision: FindingDecision;
  decision_note: string | null;
  created_at: string;
}

export interface ComparisonWithFindings extends Comparison {
  findings: Finding[];
  move_in_photo?: PhotoWithUrl | null;
  move_out_photo?: PhotoWithUrl | null;
}

export interface InspectionWithPhotos extends Inspection {
  photos: PhotoWithUrl[];
}

export interface PropertyDetail extends Property {
  inspections: {
    move_in: InspectionWithPhotos | null;
    move_out: InspectionWithPhotos | null;
  };
  move_in_count?: number;
  move_out_count?: number;
}

export interface PropertyListItem extends Property {
  move_in_count: number;
  move_out_count: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & {
          created_at?: string;
        };
        Update: Partial<Omit<Profile, "user_id">>;
      };
      owner_properties: {
        Row: OwnerProperty;
        Insert: Omit<OwnerProperty, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<OwnerProperty, "id" | "owner_id">>;
      };
      tenancy_links: {
        Row: TenancyLink;
        Insert: Omit<TenancyLink, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<TenancyLink, "id" | "tenant_id">>;
      };
      properties: {
        Row: Property;
        Insert: Omit<Property, "id" | "created_at" | "share_token"> & {
          id?: string;
          created_at?: string;
          share_token?: string;
        };
        Update: Partial<Omit<Property, "id" | "user_id">>;
      };
      inspections: {
        Row: Inspection;
        Insert: Omit<Inspection, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Inspection, "id" | "user_id">>;
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Photo, "id" | "user_id">>;
      };
      comparisons: {
        Row: Comparison;
        Insert: Omit<Comparison, "id" | "created_at" | "status" | "error"> & {
          id?: string;
          status?: ComparisonStatus;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<Comparison, "id" | "user_id">>;
      };
      findings: {
        Row: Finding;
        Insert: Omit<Finding, "id" | "created_at" | "decision"> & {
          id?: string;
          decision?: FindingDecision;
          created_at?: string;
        };
        Update: Partial<Omit<Finding, "id" | "user_id">>;
      };
    };
  };
}
