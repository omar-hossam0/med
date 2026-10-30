import type { DemoUser, UserStats } from "@/lib/mock/users";
import type { DirectoryMember } from "@/lib/mock/doctorsStaff";

/**
 * Thin client for the admin API.
 *
 * Every call carries the session cookie; every mutation echoes the CSRF token
 * from the readable `medora_csrf` cookie, matching the backend's
 * session-bound double-submit check.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: { field: string; message: string }[];

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export type Pagination = {
  total: number;
  limit: number;
  offset: number;
  returned: number;
  hasMore: boolean;
};

export type DirectoryStats = {
  doctors: number;
  staff: number;
  pendingVerification: number;
  onDuty: number;
  total: number;
};

export type ReferenceSpecialty = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type ReferenceDepartment = {
  id: string;
  name: string;
  slug: string;
  kind: "clinical" | "support";
  specialty_id: string | null;
  specialty_name: string | null;
  is_active: boolean;
};

export type ReferenceLocation = {
  id: string;
  name: string;
  address?: string;
  city: string;
  country_code: string;
  timezone: string;
  is_active: boolean;
};

export type ReferenceDataResponse = {
  success: boolean;
  specialties: ReferenceSpecialty[];
  departments: ReferenceDepartment[];
  locations: ReferenceLocation[];
};

export type AccountStatus = "active" | "pending" | "suspended" | "inactive";

export type UserListResponse = {
  success: boolean;
  users: DemoUser[];
  stats: UserStats;
  pagination: Pagination;
};

export type DirectoryResponse = {
  success: boolean;
  members: DirectoryMember[];
  stats: DirectoryStats;
  pagination: Pagination;
};

export type CreateUserPayload = {
  full_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  role: "doctor" | "staff";
  location?: string | null;
  about?: string | null;
  doctor?: {
    specialty?: string;
    department?: string;
    license_number?: string;
    professional_title?: string;
    years_of_experience?: number | null;
  };
  staff?: {
    job_title?: string;
    employment_id?: string;
    department?: string;
    work_shift?: string;
  };
};

export type CreatedUserResponse = {
  success: boolean;
  user: DemoUser;
  invitation: {
    purpose: string;
    expires_at: string;
    activation_token: string;
    activation_path: string;
  };
};

function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)medora_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    headers.set("x-csrf-token", readCsrfToken());
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.message || "The request could not be completed.",
      response.status,
      data?.code,
      data?.errors,
    );
  }

  return data as T;
}

/**
 * Consume a one-time invitation or password-reset token.
 * Public endpoint: the token is the credential, so no session is required.
 */
export function activateAccount(
  token: string,
  password: string,
): Promise<{ success: boolean; message: string; user: { id: string; email: string; status: string } }> {
  return request("/api/auth/activate", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export const adminApi = {
  listUsers(): Promise<UserListResponse> {
    return request<UserListResponse>("/api/admin/users");
  },
  createUser(payload: CreateUserPayload): Promise<CreatedUserResponse> {
    return request<CreatedUserResponse>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  listDirectory(): Promise<DirectoryResponse> {
    return request<DirectoryResponse>("/api/admin/doctors-staff");
  },

  getMember(id: string): Promise<{ success: boolean; member: DirectoryMember }> {
    return request(`/api/admin/doctors-staff/${encodeURIComponent(id)}`);
  },

  getReferenceData(): Promise<ReferenceDataResponse> {
    return request<ReferenceDataResponse>("/api/admin/reference-data");
  },

  updateUserStatus(
    id: string,
    payload: { status: AccountStatus; reason: string },
  ): Promise<{ success: boolean; user: DemoUser }> {
    return request(`/api/admin/users/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  issueInvitation(
    id: string,
    purpose: "invite" | "password_reset",
  ): Promise<{
    success: boolean;
    invitation: { expires_at: string; activation_token: string; activation_path: string };
  }> {
    return request(`/api/admin/users/${encodeURIComponent(id)}/invitations`, {
      method: "POST",
      body: JSON.stringify({ purpose }),
    });
  },

  setVerification(
    id: string,
    payload: { status: "pending" | "verified" | "rejected"; note?: string },
  ): Promise<{ success: boolean; member: DirectoryMember }> {
    return request(`/api/admin/doctors-staff/${encodeURIComponent(id)}/verification`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
