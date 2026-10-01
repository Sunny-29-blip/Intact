export type InspectionKind = "move_in" | "move_out";
export type ComparisonStatus = "pending" | "complete" | "failed";
export type FindingClassification = "damage" | "wear" | "unclear";
export type FindingSeverity = "minor" | "moderate" | "major";
export type FindingDecision = "pending" | "accepted" | "disputed";

export interface Property {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  tenancy_start: string; // ISO Date YYYY-MM-DD
  tenancy_end: string | null;
  lease_notes: string | null;
  share_token: string;
  created_at: string;
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

export interface Database {
  public: {
    Tables: {
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
