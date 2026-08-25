-- Add an explicit content format to lessons so admins can author/upload HTML
-- lessons (rendered as rich HTML) alongside the existing plain-text lessons.
-- Idempotent: safe to re-run.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "contentFormat" TEXT NOT NULL DEFAULT 'markdown';
