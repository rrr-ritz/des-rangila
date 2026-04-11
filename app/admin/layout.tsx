"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { signOut } from "@/lib/firebase/auth";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Package,
  UserCheck,
  UserPlus,
  Camera,
  FileText,
  ScanFace,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/check-in", label: "Check-in", icon: UserPlus },
  { href: "/admin/attendees", label: "Attendees", icon: Users },
  { href: "/admin/stations", label: "Stations", icon: MapPin },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/volunteers", label: "Volunteers", icon: UserCheck },
  { href: "/admin/photos", label: "Photos", icon: Camera },
  { href: "/admin/face-recognition", label: "Face Match", icon: ScanFace },
  { href: "/admin/audit-log", label: "Audit Log", icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/staff");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    router.push("/staff");
  }

  return (
    <div className="flex min-h-screen">
      {/* Skip navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Admin navigation"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="font-bold text-lg font-display text-[var(--color-primary)]">
                Des Rangila
              </h2>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
            <button
              className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1" aria-label="Admin pages">
            {navItems.filter((item) => {
              // Hide Face Match for Dhruv
              if (item.href === "/admin/face-recognition" && user.email === "dhruvsuri312@gmail.com") {
                return false;
              }
              return true;
            }).map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2 truncate">
              {user.email}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-sm">Des Rangila Admin</h1>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
