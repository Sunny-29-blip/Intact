import type {
  PropertyListItem,
  PropertyDetail,
  Property,
  PhotoWithUrl,
  Inspection,
  ApiResponse,
} from "@/types/database";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  RegisterPhotoInput,
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
  // Properties
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
};

export { ApiError };
