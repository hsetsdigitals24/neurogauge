"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, LogIn, ArrowLeft, Settings, FolderPlus, LayoutDashboard, Users, GraduationCap, Shield, BarChart3, Menu, X } from "lucide-react";
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

// Primary nav links, shared between the inline (large-screen) row and the
// mobile dropdown menu so both stay in sync.
const NAV_LINKS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  accent?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/consulting", label: "Consulting", icon: Users },
  { href: "/dashboard/training", label: "Training", icon: GraduationCap },
  { href: "/dashboard/admin", label: "Admin", icon: Shield, adminOnly: true, accent: true },
  { href: "/results", label: "Results", icon: BarChart3 },
];

export function Header({ showBackButton = false, backHref = "/", title }: HeaderProps) {
  const [user, setUser] = useState<{ name: string; email: string; accountType?: AccountType; isAdmin?: boolean; projectCredits?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Re-fetch auth state on every route change, not just first mount. The Header
  // lives in the persistent root layout, so after a client-side navigation (e.g.
  // login → /dashboard) it would otherwise keep showing the stale logged-out
  // state until a full refresh. Refetching on pathname change also keeps the
  // name badge + credit pill in sync after actions like buying credits.
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        const text = await r.text();
        return text ? JSON.parse(text) : {};
      })
      .then((d) => { if (active) setUser(d.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pathname]);

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
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 group min-w-0"
        >
          {/* Logo */}
          <div className="font-bold text-base sm:text-lg md:text-xl leading-tight gradient-text flex-shrink-0">
            <Image
              src="/assets/Asset 4@4x.png"
              alt="Logo"
              width={100}
              height={30}
              className="h-auto w-auto"
            />
            <div className="text-xs leading-tight text-[color:var(--muted)] hidden sm:block truncate">
              Neuroscience Lab
            </div>
          </div>

          {/* Divider — only when there are account details to show beside the logo */}
          {(user || title) && (
            <span
              aria-hidden
              className="h-8 w-px flex-shrink-0 bg-[color:var(--border)]"
            />
          )}

          {/* Account details, side-by-side with the logo */}
          {!title && user && (
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-sm leading-tight text-[color:var(--fg)] font-semibold truncate">
                {user.name}
              </span>
              {user.accountType && (
                <span className="text-[10px] leading-tight text-[color:var(--muted)] font-medium uppercase tracking-wide truncate">
                  {ACCOUNT_TYPE_LABEL[user.accountType]}
                </span>
              )}
            </div>
          )}
          {/* {!title && !user && (
            <div className="text-xs leading-tight text-[color:var(--muted)] hidden sm:block truncate">
              Neuroscience Lab
            </div>
          )} */}
          {title && (
            <div className="text-xs leading-tight text-[color:var(--muted)] truncate">
              {title}
            </div>
          )}
        </Link>
      </div>

      <nav className="flex items-center gap-3 sm:gap-4 lg:gap-5 flex-shrink-0">
        {!loading && user ? (
          <>
            {/* Full inline nav on large screens */}
            {NAV_LINKS.filter((l) => !l.adminOnly || user.isAdmin).map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  title={l.label}
                  className={`hidden lg:inline-flex items-center gap-1.5 text-sm transition-colors ${
                    l.accent
                      ? "text-indigo-600 hover:text-indigo-700"
                      : "text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{l.label}</span>
                </Link>
              );
            })}

            {/* Credit pill — always visible */}
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

            {/* Settings + Sign out — inline on large screens only */}
            <Link
              href="/dashboard/settings"
              title="Profile & settings"
              className="hidden lg:inline-flex items-center gap-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
            <button
              onClick={logout}
              title="Sign out"
              className="hidden lg:inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>

            {/* Hamburger — below lg */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="lg:hidden inline-flex items-center justify-center p-2 -mr-2 text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
            >
              {menuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </>
        ) : !loading ? (
          <>
            <Link
              href="/auth/login"
              title="Sign in"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Get Started
            </Link>
          </>
        ) : (
          <div className="w-16 h-8 bg-[color:var(--border)] rounded animate-pulse" />
        )}
      </nav>

      {/* Mobile dropdown menu (below lg) */}
      {!loading && user && menuOpen && (
        <>
          {/* Click-away backdrop */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="lg:hidden fixed inset-0 top-[var(--header-h,64px)] z-10 cursor-default"
          />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="lg:hidden absolute right-2 top-full mt-1 w-56 z-20 rounded-xl border border-[color:var(--border)] bg-white shadow-lg p-2 flex flex-col"
          >
            {NAV_LINKS.filter((l) => !l.adminOnly || user.isAdmin).map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[color:var(--border)]/40 ${
                    l.accent ? "text-indigo-600" : "text-[color:var(--fg)]"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{l.label}</span>
                </Link>
              );
            })}
            <div className="my-1 border-t border-[color:var(--border)]" />
            <Link
              href="/dashboard/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[color:var(--fg)] transition-colors hover:bg-[color:var(--border)]/40"
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 text-left"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Sign out</span>
            </button>
          </motion.div>
        </>
      )}
    </motion.header>
  );
}
