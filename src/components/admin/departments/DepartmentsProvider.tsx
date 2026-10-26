"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  seedDepartments,
  calculateDepartmentsGlobalStats,
  type Department,
  type DepartmentIconKey,
  type DepartmentStatus,
} from "@/lib/mock/departments";

export type DepartmentTab = "all" | "active" | "inactive";
export type DepartmentView = "grid" | "list";

export type DepartmentCreateInput = {
  name: string;
  description: string;
  icon: DepartmentIconKey;
  status?: DepartmentStatus;
  displayOrder?: number;
  headOfDepartment?: string;
  location?: string;
  locationAddress?: string;
  services?: string[];
};

type ToastState = {
  message: string;
  type: "success" | "info" | "error";
  visible: boolean;
};

type DepartmentsContextValue = {
  departments: Department[];
  filteredDepartments: Department[];
  stats: ReturnType<typeof calculateDepartmentsGlobalStats>;
  tab: DepartmentTab;
  setTab: (t: DepartmentTab) => void;
  view: DepartmentView;
  setView: (v: DepartmentView) => void;
  search: string;
  setSearch: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  clearFilters: () => void;

  // Modals state & controls
  isAddModalOpen: boolean;
  openAddModal: () => void;
  closeAddModal: () => void;

  editingDept: Department | null;
  openEditModal: (d: Department) => void;
  closeEditModal: () => void;

  managingDoctorsDept: Department | null;
  openManageDoctorsModal: (d: Department) => void;
  closeManageDoctorsModal: () => void;

  managingServicesDept: Department | null;
  openManageServicesModal: (d: Department) => void;
  closeManageServicesModal: () => void;

  deactivatingDept: Department | null;
  openDeactivateDialog: (d: Department) => void;
  closeDeactivateDialog: () => void;

  // Mutations
  createDepartment: (input: DepartmentCreateInput) => Department;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  duplicateDepartment: (id: string) => void;
  toggleDepartmentStatus: (id: string) => void;
  updateDepartmentDoctors: (id: string, doctorIds: string[]) => void;
  updateDepartmentServices: (id: string, services: string[]) => void;

  // Toast
  toast: ToastState;
  showToast: (message: string, type?: "success" | "info" | "error") => void;
  hideToast: () => void;
};

const DepartmentsContext = createContext<DepartmentsContextValue | undefined>(
  undefined,
);

export function DepartmentsProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<Department[]>(seedDepartments);
  const [tab, setTab] = useState<DepartmentTab>("all");
  const [view, setView] = useState<DepartmentView>("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sortBy, setSortBy] = useState("Name (A-Z)");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [managingDoctorsDept, setManagingDoctorsDept] =
    useState<Department | null>(null);
  const [managingServicesDept, setManagingServicesDept] =
    useState<Department | null>(null);
  const [deactivatingDept, setDeactivatingDept] =
    useState<Department | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "success",
    visible: false,
  });

  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "success") => {
      setToast({ message, type, visible: true });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("All Statuses");
    setSortBy("Name (A-Z)");
    setTab("all");
  }, []);

  const openAddModal = useCallback(() => setIsAddModalOpen(true), []);
  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

  const openEditModal = useCallback((d: Department) => setEditingDept(d), []);
  const closeEditModal = useCallback(() => setEditingDept(null), []);

  const openManageDoctorsModal = useCallback(
    (d: Department) => setManagingDoctorsDept(d),
    [],
  );
  const closeManageDoctorsModal = useCallback(
    () => setManagingDoctorsDept(null),
    [],
  );

  const openManageServicesModal = useCallback(
    (d: Department) => setManagingServicesDept(d),
    [],
  );
  const closeManageServicesModal = useCallback(
    () => setManagingServicesDept(null),
    [],
  );

  const openDeactivateDialog = useCallback(
    (d: Department) => setDeactivatingDept(d),
    [],
  );
  const closeDeactivateDialog = useCallback(
    () => setDeactivatingDept(null),
    [],
  );

  // Mutations
  const createDepartment = useCallback(
    (input: DepartmentCreateInput): Department => {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const id = `${slug || "dept"}-${Date.now().toString(36)}`;
      const now = new Date();
      const dateFormatted = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeFormatted = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newDept: Department = {
        id,
        name: input.name.trim(),
        slug,
        description: input.description.trim(),
        icon: input.icon,
        status: input.status || "active",
        displayOrder: input.displayOrder || departments.length + 1,
        assignedDoctorIds: [],
        services: input.services?.length ? input.services : ["General Consultation"],
        headOfDepartment: input.headOfDepartment,
        location: input.location || "Main Hospital",
        locationBadge: input.location === "Main Hospital" ? "Primary" : undefined,
        locationAddress: input.locationAddress || "123 Health St, Cairo, Egypt",
        createdAt: dateFormatted,
        updatedAt: `${dateFormatted}, ${timeFormatted}`,
        stats: {
          assignedDoctors: 0,
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
        },
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            action: "Department created",
            timestamp: `${dateFormatted}, ${timeFormatted}`,
            actor: "Medora Administrator",
            type: "created",
          },
        ],
      };

      setDepartments((prev) => [newDept, ...prev]);
      showToast(
        `Department "${newDept.name}" created successfully (demo).`,
        "success",
      );
      return newDept;
    },
    [departments.length, showToast],
  );

  const updateDepartment = useCallback(
    (id: string, updates: Partial<Department>) => {
      const now = new Date();
      const dateFormatted = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeFormatted = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const timestamp = `${dateFormatted}, ${timeFormatted}`;

      setDepartments((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const updated: Department = {
            ...d,
            ...updates,
            updatedAt: timestamp,
            recentActivity: [
              {
                id: `act-${Date.now()}`,
                action: "Department details updated",
                timestamp,
                actor: "Medora Administrator",
                type: "updated",
              },
              ...d.recentActivity,
            ],
          };
          return updated;
        }),
      );

      // Keep editing/detail views synchronized
      setEditingDept((current) =>
        current && current.id === id ? { ...current, ...updates } : current,
      );
      showToast("Department details updated successfully.", "success");
    },
    [showToast],
  );

  const duplicateDepartment = useCallback(
    (id: string) => {
      const source = departments.find((d) => d.id === id);
      if (!source) return;

      const newName = `${source.name} (Copy)`;
      const newSlug = `${source.slug}-copy-${Date.now().toString(36)}`;
      const now = new Date();
      const dateFormatted = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeFormatted = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const clone: Department = {
        ...source,
        id: newSlug,
        slug: newSlug,
        name: newName,
        displayOrder: departments.length + 1,
        createdAt: dateFormatted,
        updatedAt: `${dateFormatted}, ${timeFormatted}`,
        assignedDoctorIds: [], // Per prompt: do not duplicate doctor assignments automatically
        stats: {
          assignedDoctors: 0,
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
        },
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            action: `Duplicated from ${source.name}`,
            timestamp: `${dateFormatted}, ${timeFormatted}`,
            actor: "Medora Administrator",
            type: "created",
          },
        ],
      };

      setDepartments((prev) => [clone, ...prev]);
      showToast(`Duplicated "${source.name}" as "${newName}".`, "success");
    },
    [departments, showToast],
  );

  const toggleDepartmentStatus = useCallback(
    (id: string) => {
      const now = new Date();
      const timestamp = `${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}, ${now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      setDepartments((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const nextStatus: DepartmentStatus =
            d.status === "active" ? "inactive" : "active";
          return {
            ...d,
            status: nextStatus,
            updatedAt: timestamp,
            recentActivity: [
              {
                id: `act-${Date.now()}`,
                action: `Status changed to ${
                  nextStatus === "active" ? "Active" : "Inactive"
                }`,
                timestamp,
                actor: "Medora Administrator",
                type: "status_changed",
              },
              ...d.recentActivity,
            ],
          };
        }),
      );

      const target = departments.find((d) => d.id === id);
      const nextLabel = target?.status === "active" ? "Inactive" : "Active";
      showToast(
        `Department status changed to ${nextLabel}.`,
        nextLabel === "Active" ? "success" : "info",
      );
    },
    [departments, showToast],
  );

  const updateDepartmentDoctors = useCallback(
    (id: string, doctorIds: string[]) => {
      const now = new Date();
      const timestamp = `${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}, ${now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      setDepartments((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const diff = doctorIds.length - d.assignedDoctorIds.length;
          const actionText =
            diff > 0
              ? `${diff} new doctor(s) assigned`
              : diff < 0
              ? `${Math.abs(diff)} doctor(s) unassigned`
              : "Doctor roster updated";

          return {
            ...d,
            assignedDoctorIds: doctorIds,
            updatedAt: timestamp,
            stats: {
              ...d.stats,
              assignedDoctors: doctorIds.length,
            },
            recentActivity: [
              {
                id: `act-${Date.now()}`,
                action: actionText,
                timestamp,
                actor: "Medora Administrator",
                type: "doctor_assigned",
              },
              ...d.recentActivity,
            ],
          };
        }),
      );

      showToast("Doctor assignments updated successfully.", "success");
    },
    [showToast],
  );

  const updateDepartmentServices = useCallback(
    (id: string, services: string[]) => {
      const now = new Date();
      const timestamp = `${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}, ${now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      setDepartments((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          return {
            ...d,
            services,
            updatedAt: timestamp,
            recentActivity: [
              {
                id: `act-${Date.now()}`,
                action: "Services updated",
                timestamp,
                actor: "Medora Administrator",
                type: "updated",
              },
              ...d.recentActivity,
            ],
          };
        }),
      );

      showToast("Services and specialties updated.", "success");
    },
    [showToast],
  );

  // Global derived stats
  const stats = useMemo(
    () => calculateDepartmentsGlobalStats(departments),
    [departments],
  );

  // Filtered & sorted departments
  const filteredDepartments = useMemo(() => {
    let result = [...departments];

    // Tab filter
    if (tab === "active") {
      result = result.filter((d) => d.status === "active");
    } else if (tab === "inactive") {
      result = result.filter((d) => d.status === "inactive");
    }

    // Status filter dropdown
    if (statusFilter === "Active") {
      result = result.filter((d) => d.status === "active");
    } else if (statusFilter === "Inactive") {
      result = result.filter((d) => d.status === "inactive");
    }

    // Search query
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.services.some((s) => s.toLowerCase().includes(q)) ||
          (d.headOfDepartment && d.headOfDepartment.toLowerCase().includes(q)),
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "Name (A-Z)":
          return a.name.localeCompare(b.name);
        case "Name (Z-A)":
          return b.name.localeCompare(a.name);
        case "Newest First":
          return b.displayOrder - a.displayOrder;
        case "Oldest First":
          return a.displayOrder - b.displayOrder;
        case "Display Order":
          return a.displayOrder - b.displayOrder;
        default:
          return 0;
      }
    });

    return result;
  }, [departments, tab, statusFilter, search, sortBy]);

  const value = useMemo(
    () => ({
      departments,
      filteredDepartments,
      stats,
      tab,
      setTab,
      view,
      setView,
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      sortBy,
      setSortBy,
      clearFilters,

      isAddModalOpen,
      openAddModal,
      closeAddModal,

      editingDept,
      openEditModal,
      closeEditModal,

      managingDoctorsDept,
      openManageDoctorsModal,
      closeManageDoctorsModal,

      managingServicesDept,
      openManageServicesModal,
      closeManageServicesModal,

      deactivatingDept,
      openDeactivateDialog,
      closeDeactivateDialog,

      createDepartment,
      updateDepartment,
      duplicateDepartment,
      toggleDepartmentStatus,
      updateDepartmentDoctors,
      updateDepartmentServices,

      toast,
      showToast,
      hideToast,
    }),
    [
      departments,
      filteredDepartments,
      stats,
      tab,
      view,
      search,
      statusFilter,
      sortBy,
      clearFilters,
      isAddModalOpen,
      openAddModal,
      closeAddModal,
      editingDept,
      openEditModal,
      closeEditModal,
      managingDoctorsDept,
      openManageDoctorsModal,
      closeManageDoctorsModal,
      managingServicesDept,
      openManageServicesModal,
      closeManageServicesModal,
      deactivatingDept,
      openDeactivateDialog,
      closeDeactivateDialog,
      createDepartment,
      updateDepartment,
      duplicateDepartment,
      toggleDepartmentStatus,
      updateDepartmentDoctors,
      updateDepartmentServices,
      toast,
      showToast,
      hideToast,
    ],
  );

  return (
    <DepartmentsContext.Provider value={value}>
      {children}
    </DepartmentsContext.Provider>
  );
}

export function useDepartments() {
  const ctx = useContext(DepartmentsContext);
  if (!ctx) {
    throw new Error("useDepartments must be used within a DepartmentsProvider");
  }
  return ctx;
}
