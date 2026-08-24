"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { FlaskConical, Users, ChevronRight } from "lucide-react";

export interface ProjectCardData {
  id: string;
  name: string;
  shareToken: string;
  createdAt: string;
  updatedAt?: string;
  owner?: { name: string; email: string };
  _count: { sessions: number; collaborators: number };
}

export function ProjectCard({
  project, isOwner, delay,
}: { project: ProjectCardData; isOwner: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link href={`/dashboard/projects/${project.id}`} className="block card p-5 hover:shadow-lg transition-shadow group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base truncate">{project.name}</h3>
              {isOwner ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">Owner</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-100">Collaborator</span>
              )}
            </div>
            {!isOwner && project.owner && (
              <p className="text-xs text-[color:var(--muted)] mt-0.5">
                by {project.owner.name}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-[color:var(--muted)] group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm text-[color:var(--muted)]">
          <span className="flex items-center gap-1">
            <FlaskConical className="w-4 h-4" />
            {project._count.sessions} sessions
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {project._count.collaborators} collaborators
          </span>
          <span className="ml-auto text-xs">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
