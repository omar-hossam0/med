"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { adminApi, ApiError, type CreateUserPayload } from "@/lib/api/admin";
import type { DemoUser, UserStats } from "@/lib/mock/users";

type NewUserInput = {
  name: string;
  email: string;
  phone: string;
  role: "doctor" | "staff";
  /** Optional detail fields so the record also appears in Doctors & Staff. */
  profile?: DemoUser["profile"];
};

type CreatedUser = {
  user: DemoUser;
  /** One-time activation link. Shown once; it cannot be retrieved later. */
  activationPath: string;
};

type UsersContextValue = {
  users: DemoUser[];
  stats: UserStats;
  loading: boolean;
  error: string | null;
  addUser: (input: NewUserInput) => Promise<CreatedUser>;
  refresh: () => Promise<void>;
};

const EMPTY_STATS: UserStats = { total: 0, patients: 0, doctors: 0, staff: 0 };

const UsersContext = createContext<UsersContextValue | undefined>(undefined);

/**
 * Holds the account directory for the admin area.
 *
 * State starts empty rather than seeded: the page must only ever show rows that
 * exist in PostgreSQL. If the request fails, the error is surfaced instead of
 * falling back to sample data.
 */
export function UsersProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(data.users);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setUsers([]);
      setStats(EMPTY_STATS);
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addUser = useCallback(
    async (input: NewUserInput): Promise<CreatedUser> => {
      const profile = input.profile ?? {};

      const payload: CreateUserPayload = {
        full_name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim() || null,
        date_of_birth: profile.dob || null,
        role: input.role,
        location: profile.location || null,
        about: profile.about || null,
      };

      if (input.role === "doctor") {
        payload.doctor = {
          specialty: profile.specialty,
          department: profile.department,
          license_number: profile.license,
          years_of_experience: profile.years ? Number(profile.years) : null,
        };
      } else {
        payload.staff = {
          job_title: profile.jobTitle,
          employment_id: profile.employmentId,
          department: profile.department,
          work_shift: profile.schedule,
        };
      }

      const created = await adminApi.createUser(payload);
      await refresh();

      return {
        user: created.user,
        activationPath: created.invitation.activation_path,
      };
    },
    [refresh],
  );

  return (
    <UsersContext.Provider
      value={{ users, stats, loading, error, addUser, refresh }}
    >
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within a UsersProvider");
  return ctx;
}
