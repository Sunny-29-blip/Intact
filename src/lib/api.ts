import type {
  PropertyListItem,
  PropertyDetail,
  Property,
  PhotoWithUrl,
  Inspection,
  ComparisonWithFindings,
  Finding,
  ApiResponse,
  Profile,
  OwnerProperty,
  OwnerPropertyDetail,
  TenantLinkedOwnerProperty,
  Document,
} from "@/types/database";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  RegisterPhotoInput,
  UpdateFindingDecisionInput,
  CreateProfileInput,
  UpdateProfileInput,
  CreateOwnerPropertyInput,
  UpdateOwnerPropertyInput,
  LinkTenancyInput,
  RegisterDocumentInput,
} from "@/lib/validation";

class ApiError extends Error {
  code: string;
  details?: Record<string, string[]>;

  constructor(message: string, code = "API_ERROR", details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  const result: ApiResponse<T> = await response.json().catch(() => ({
    error: { code: "INVALID_RESPONSE", message: "Failed to parse response" },
  }));

  if (!response.ok || result.error) {
    const error = result.error || {
      code: `HTTP_${response.status}`,
      message: response.statusText || "Request failed",
    };
    throw new ApiError(error.message, error.code, error.details);
  }

  return result.data as T;
}

export const api = {
  // Profiles
  async getProfile(): Promise<Profile> {
    return request<Profile>("/api/profile");
  },

  async createProfile(data: CreateProfileInput): Promise<Profile> {
    return request<Profile>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProfile(data: UpdateProfileInput): Promise<Profile> {
    return request<Profile>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Owner Properties
  async getOwnerProperties(): Promise<OwnerProperty[]> {
    return request<OwnerProperty[]>("/api/owner/properties");
  },

  async createOwnerProperty(data: CreateOwnerPropertyInput): Promise<OwnerProperty> {
    return request<OwnerProperty>("/api/owner/properties", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getOwnerProperty(id: string): Promise<OwnerPropertyDetail> {
    return request<OwnerPropertyDetail>(`/api/owner/properties/${id}`);
  },

  async updateOwnerProperty(id: string, data: UpdateOwnerPropertyInput): Promise<OwnerProperty> {
    return request<OwnerProperty>(`/api/owner/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteOwnerProperty(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/owner/properties/${id}`, {
      method: "DELETE",
    });
  },

  // Tenancy Links (Tenant side)
  async getTenantLinks(propertyId?: string): Promise<TenantLinkedOwnerProperty[]> {
    const url = propertyId ? `/api/links?propertyId=${encodeURIComponent(propertyId)}` : "/api/links";
    return request<TenantLinkedOwnerProperty[]>(url);
  },

  async linkTenancy(data: LinkTenancyInput): Promise<TenantLinkedOwnerProperty> {
    return request<TenantLinkedOwnerProperty>("/api/links", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateLinkShare(id: string, shared: boolean): Promise<TenantLinkedOwnerProperty> {
    return request<TenantLinkedOwnerProperty>(`/api/links/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ shared }),
    });
  },

  async unlinkTenancy(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/links/${id}`, {
      method: "DELETE",
    });
  },

  // Tenant Properties
  async getProperties(): Promise<PropertyListItem[]> {
    return request<PropertyListItem[]>("/api/properties");
  },

  async createProperty(data: CreatePropertyInput): Promise<Property> {
    return request<Property>("/api/properties", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getProperty(id: string): Promise<PropertyDetail> {
    return request<PropertyDetail>(`/api/properties/${id}`);
  },

  async updateProperty(id: string, data: UpdatePropertyInput): Promise<Property> {
    return request<Property>(`/api/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteProperty(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/properties/${id}`, {
      method: "DELETE",
    });
  },

  // Inspections
  async getOrCreateInspection(
    propertyId: string,
    kind: "move_in" | "move_out"
  ): Promise<Inspection> {
    return request<Inspection>(`/api/properties/${propertyId}/inspections`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    });
  },

  // Photos
  async registerPhoto(data: RegisterPhotoInput): Promise<PhotoWithUrl> {
    return request<PhotoWithUrl>("/api/photos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deletePhoto(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/photos/${id}`, {
      method: "DELETE",
    });
  },

  // Comparisons
  async triggerComparison(propertyId: string, area: string): Promise<ComparisonWithFindings> {
    return request<ComparisonWithFindings>("/api/comparisons", {
      method: "POST",
      body: JSON.stringify({ propertyId, area }),
    });
  },

  async getComparisons(propertyId: string): Promise<ComparisonWithFindings[]> {
    return request<ComparisonWithFindings[]>(`/api/comparisons?propertyId=${encodeURIComponent(propertyId)}`);
  },

  // Findings
  async updateFindingDecision(
    id: string,
    data: UpdateFindingDecisionInput
  ): Promise<Finding> {
    return request<Finding>(`/api/findings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Documents
  async registerDocument(data: RegisterDocumentInput): Promise<Document> {
    return request<Document>("/api/documents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDocumentSignedUrl(id: string): Promise<{ signedUrl: string }> {
    return request<{ signedUrl: string }>(`/api/documents/${id}/url`);
  },

  async deleteDocument(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/api/documents/${id}`, {
      method: "DELETE",
    });
  },
};

export { ApiError };
