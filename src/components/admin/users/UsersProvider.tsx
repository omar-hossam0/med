"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  seedUsers,
  baseStats,
  type DemoUser,
  type UserStats,
} from "@/lib/mock/users";

type NewUserInput = {
  name: string;
  email: string;
  phone: string;
  role: "doctor" | "staff";
  /** Optional detail fields so the record also appears in Doctors & Staff. */
  profile?: DemoUser["profile"];
};

type UsersContextValue = {
  users: DemoUser[];
  stats: UserStats;
  addUser: (input: NewUserInput) => DemoUser;
};

const UsersContext = createContext<UsersContextValue | undefined>(undefined);

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<DemoUser[]>(seedUsers);
  const [stats, setStats] = useState<UserStats>(baseStats);

  const addUser = useCallback((input: NewUserInput) => {
    const user: DemoUser = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `u${Date.now()}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      role: input.role,
      status: "pending",
      joinedAt: new Date().toISOString().slice(0, 10),
      profile: input.profile,
    };

    setUsers((prev) => [user, ...prev]);
    setStats((s) => ({
      total: s.total + 1,
      patients: s.patients,
      doctors: s.doctors + (input.role === "doctor" ? 1 : 0),
      staff: s.staff + (input.role === "staff" ? 1 : 0),
    }));

    return user;
  }, []);

  return (
    <UsersContext.Provider value={{ users, stats, addUser }}>
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within a UsersProvider");
  return ctx;
}
