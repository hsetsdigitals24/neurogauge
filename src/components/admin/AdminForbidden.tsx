import Link from "next/link";
import { ShieldAlert } from "lucide-react";

// Shown when a non-admin lands on an admin page (the backing API returned 403).
export function AdminForbidden() {
  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-2xl mx-auto w-full">
        <div className="mt-20 card p-10 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-rose-500" />
          <h1 className="text-xl font-bold mt-3">Admins only</h1>
          <p className="text-sm text-[color:var(--muted)] mt-1">You don&apos;t have access to this area.</p>
          <Link href="/dashboard" className="btn btn-primary mt-4 inline-flex">Back to dashboard</Link>
        </div>
      </main>
    </div>
  );
}
