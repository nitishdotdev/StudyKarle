export const SUBJECT_COLORS = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
  },
  secondary: {
    bg: "bg-secondary/10",
    text: "text-secondary",
  },
  tertiary: {
    bg: "bg-tertiary/10",
    text: "text-tertiary",
  },
};

export const NAV_ITEMS = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { label: "Access", icon: "lock_open", path: "/access" },
  { label: "Search", icon: "search", path: "/search" },
  { label: "Saved", icon: "bookmark", path: "/saved" },
  { label: "Profile", icon: "person", path: "/profile" },
];

export const ADMIN_NAV_ITEMS = [
  { label: "Overview", icon: "dashboard", path: "/admin" },
  { label: "Payments", icon: "payments", path: "/admin/payments" },
  { label: "Upload Notes", icon: "cloud_upload", path: "/admin/upload" },
  { label: "All Notes", icon: "description", path: "/admin/notes" },
  { label: "Manage Subjects", icon: "category", path: "/admin/subjects" },
  { label: "Manage Users", icon: "group", path: "/admin/users" },
  { label: "Analytics", icon: "analytics", path: "/admin/analytics" },
  {label: "View History", icon: "history", path: "/admin/view-history"},
];
