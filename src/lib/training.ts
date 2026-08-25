import crypto from "crypto";

// Slugify a course title into a URL-safe, unique-ish slug.
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || "course";
}

// Human-friendly certificate serial, e.g. NG-A1B2-C3D4. Uppercase, no ambiguous
// characters, used as the public verify code.
export function certificateSerial(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const pick = () => alphabet[crypto.randomInt(alphabet.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `NG-${block()}-${block()}`;
}

export interface QuizQuestionForGrading {
  id: string;
  correctIndex: number;
}

// Grade a quiz: answers is a map of questionId → chosen option index.
export function gradeQuiz(
  questions: QuizQuestionForGrading[],
  answers: Record<string, number>,
  passThreshold: number,
): { score: number; passed: boolean } {
  if (questions.length === 0) return { score: 0, passed: false };
  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  const score = Math.round((correct / questions.length) * 100);
  return { score, passed: score >= passThreshold };
}
