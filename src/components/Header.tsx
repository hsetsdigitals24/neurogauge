"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LogOut, LogIn, ArrowLeft } from "lucide-react";

interface HeaderProps {
  showBackButton?: boolean;
  backHref?: string;
  title?: string;
}

export function Header({ showBackButton = false, backHref = "/", title }: HeaderProps) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
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
            className="btn btn-ghost btn-sm p-2 flex-shrink-0"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shimmer shadow-lg flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-lg md:text-xl leading-tight gradient-text truncate">
              Neurogauge
            </div>
            {!title && (
              <div className="text-xs leading-tight text-[color:var(--muted)] hidden sm:block truncate">
                Cognitive assessment platform
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

      <nav className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {!loading && user ? (
          <>
            <span className="text-xs sm:text-sm text-[color:var(--muted)] hidden md:inline-block whitespace-nowrap">
              {user.name}
            </span>
            <Link href="/results" className="btn btn-ghost text-xs sm:text-sm hidden sm:inline-flex">
              Results
            </Link>
            <button
              onClick={logout}
              className="btn btn-ghost text-xs sm:text-sm flex items-center gap-1"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </>
        ) : !loading ? (
          <>
            <Link href="/auth/login" className="btn btn-ghost text-xs sm:text-sm flex items-center gap-1">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
            <Link href="/auth/signup" className="btn btn-primary text-xs sm:text-sm">
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
