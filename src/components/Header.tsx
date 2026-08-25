"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LogOut, LogIn, ArrowLeft, Settings, FolderPlus, LayoutDashboard, Users, GraduationCap, Shield, BarChart3 } from "lucide-react";
import Image from "next/image";

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
  title?: string;
}

type AccountType = "student" | "institution" | "research_group";

// Human-readable label for the account type badge shown in the header.
const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  student: "Student",
  institution: "Institution",
  research_group: "Research group",
};

export function Header({ showBackButton = false, backHref = "/", title }: HeaderProps) {
  const [user, setUser] = useState<{ name: string; email: string; accountType?: AccountType; isAdmin?: boolean; projectCredits?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        const text = await r.text();
        return text ? JSON.parse(text) : {};
      })
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex items-center justify-between border-b border-[color:var(--border)] bg-white/70 backdrop-blur sticky top-0 z-10"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {showBackButton && (
          <Link
            href={backHref}
            className="inline-flex items-center p-2 flex-shrink-0 text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
          {/* <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shimmer shadow-lg flex-shrink-0" /> */}
          <div className="min-w-0">
           
            <div className="font-bold text-base sm:text-lg md:text-xl leading-tight gradient-text truncate"> 
             <Image src="/assets/Asset 4@4x.png" alt="Logo" width={100} height={30} className="h-auto w-auto" />
            </div>
            {!title && !user && (
              <div className="text-xs leading-tight text-[color:var(--muted)] hidden sm:block truncate">
                Neuroscience Lab
              </div>
            )}
            {!title && user && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs leading-tight text-[color:var(--fg)] font-semibold truncate">
                  {user.name}
                </span>
                {user.accountType && (
                  <span className="hidden sm:inline-flex flex-shrink-0 items-center rounded-full bg-indigo-50 text-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {ACCOUNT_TYPE_LABEL[user.accountType]}
                  </span>
                )}
              </div>
            )}
            {title && (
              <div className="text-xs leading-tight text-[color:var(--muted)] truncate">
                {title}
              </div>
            )}
          </div>
        </Link>
      </div>

      <nav className="flex items-center gap-3 sm:gap-4 lg:gap-5 flex-shrink-0">
        {!loading && user ? (
          <>
            <Link
              href="/dashboard"
              title="Dashboard"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors hidden sm:inline-flex"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden lg:inline">Dashboard</span>
            </Link>
            <Link
              href="/dashboard/consulting"
              title="Consulting"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors hidden md:inline-flex"
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Consulting</span>
            </Link>
            <Link
              href="/dashboard/training"
              title="Training"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors hidden md:inline-flex"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden lg:inline">Training</span>
            </Link>
            {user.isAdmin && (
              <Link
                href="/dashboard/admin"
                title="Admin"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 transition-colors hidden md:inline-flex"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden lg:inline">Admin</span>
              </Link>
            )}
            <Link
              href="/results"
              title="Results"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors hidden sm:inline-flex"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden lg:inline">Results</span>
            </Link>
            <Link
              href="/dashboard/billing"
              title="Project credits — one credit creates one project"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-xs font-semibold hover:bg-emerald-100 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{user.projectCredits ?? 0}</span>
              <span className="hidden lg:inline font-normal text-emerald-600">
                {(user.projectCredits ?? 0) === 1 ? "credit" : "credits"}
              </span>
            </Link>
            <Link
              href="/dashboard/settings"
              title="Profile & settings"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Settings</span>
            </Link>
            <button
              onClick={logout}
              title="Sign out"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </>
        ) : !loading ? (
          <>
            <Link
              href="/auth/login"
              title="Sign in"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Get Started
            </Link>
          </>
        ) : (
          <div className="w-16 h-8 bg-[color:var(--border)] rounded animate-pulse" />
        )}
      </nav>
    </motion.header>
  );
}
