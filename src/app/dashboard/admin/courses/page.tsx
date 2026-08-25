"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { notify } from "@/lib/toast";
import { formatNaira } from "@/lib/money";
import { AdminForbidden } from "@/components/admin/AdminForbidden";

interface Course {
  id: string; slug: string; title: string; summary: string; status: string; priceKobo: number;
  _count: { enrollments: number };
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  function load() {
    return fetch("/api/training/courses?includeDrafts=1")
      .then((r) => { if (r.status === 403) { setForbidden(true); return null; } return r.json(); })
      .then((d) => { if (d) setCourses(d.courses ?? []); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title.trim()) { notify.error("Enter a title"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/training/courses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not create"); return; }
      setTitle(""); notify.success("Course created"); load();
    } finally { setCreating(false); }
  }

  if (forbidden) return <AdminForbidden />;

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Link>
        </div>
        <h1 className="mt-6 text-2xl md:text-3xl font-extrabold">Courses</h1>

        <div className="mt-6 card p-4 flex items-center gap-2">
          <input className="input flex-1" placeholder="New course title…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
          <button className="btn btn-primary inline-flex items-center gap-1" disabled={creating} onClick={create}>
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading…</div>
        ) : courses.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--muted)]">No courses yet — create your first above.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/dashboard/admin/courses/${c.id}`} className="card p-5 flex items-center justify-between gap-3 hover:shadow-md transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold truncate">{c.title}</h3>
                    <span className={`text-[10px] uppercase font-bold rounded-full px-2 py-0.5 ${c.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100"}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-[color:var(--muted)] truncate">{c.summary || "No summary yet"}</p>
                </div>
                <div className="text-sm text-[color:var(--muted)] shrink-0 text-right">
                  <div>{c.priceKobo === 0 ? "Free" : formatNaira(c.priceKobo)}</div>
                  <div className="text-xs">{c._count.enrollments} enrolled</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
