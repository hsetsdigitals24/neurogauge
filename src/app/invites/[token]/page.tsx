"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, CheckCircle, XCircle } from "lucide-react";
import { notify } from "@/lib/toast";

type Status = "loading" | "ready" | "notfound" | "alreadyAccepted" | "accepting" | "done" | "error" | "wrongEmail";

interface InviteInfo {
  projectName: string;
  inviteeEmail: string;
  accepted: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invites/${token}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([inviteData, meData]) => {
      if (!inviteData) { setStatus("notfound"); return; }
      if (inviteData.accepted) { setStatus("alreadyAccepted"); return; }
      setInfo(inviteData);
      setLoggedInEmail(meData.user?.email ?? null);
      setStatus("ready");
    });
  }, [token]);

  async function accept() {
    if (!loggedInEmail) {
      // Redirect to login with redirect back
      router.push(`/auth/login?next=/invites/${token}`);
      return;
    }
    setStatus("accepting");
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setStatus("done");
      notify.success("Invite accepted");
      setTimeout(() => router.push(`/dashboard/projects/${data.projectId}`), 1800);
    } else if (res.status === 403) {
      setStatus("wrongEmail");
      setErrorMsg(data.error);
      notify.error(data.error ?? "Wrong account for this invite");
    } else {
      setStatus("error");
      setErrorMsg(data.error ?? "Something went wrong");
      notify.error(data.error ?? "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full px-6 md:px-10 py-4 flex items-center border-b border-[color:var(--border)] bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shimmer shadow" />
          <span className="font-bold gradient-text">Neurogauge</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

          {status === "loading" && (
            <div className="card p-10 text-center text-[color:var(--muted)] text-sm">Checking invite…</div>
          )}

          {status === "notfound" && (
            <div className="card p-8 text-center">
              <XCircle className="w-12 h-12 mx-auto text-[color:var(--danger)] mb-4" />
              <h1 className="text-xl font-extrabold">Invite not found</h1>
              <p className="text-sm text-[color:var(--muted)] mt-2">
                This invite link is invalid or has expired.
              </p>
              <Link href="/" className="btn btn-ghost mt-4">Go home</Link>
            </div>
          )}

          {status === "alreadyAccepted" && (
            <div className="card p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-[color:var(--success)] mb-4" />
              <h1 className="text-xl font-extrabold">Already accepted</h1>
              <p className="text-sm text-[color:var(--muted)] mt-2">
                This invite has already been accepted.
              </p>
              <Link href="/dashboard" className="btn btn-primary mt-4">Go to dashboard</Link>
            </div>
          )}

          {status === "ready" && info && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold">Collaboration invite</h1>
                  <p className="text-xs text-[color:var(--muted)]">You have been invited to collaborate</p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-5 space-y-1 text-sm">
                <div><span className="text-[color:var(--muted)]">Project: </span><strong>{info.projectName}</strong></div>
                <div><span className="text-[color:var(--muted)]">Invited email: </span><strong>{info.inviteeEmail}</strong></div>
              </div>

              {loggedInEmail ? (
                <>
                  <p className="text-sm text-[color:var(--muted)] mb-4">
                    Signed in as <strong>{loggedInEmail}</strong>.{" "}
                    {loggedInEmail.toLowerCase() !== info.inviteeEmail.toLowerCase() && (
                      <span className="text-amber-700">
                        ⚠ This invite was sent to a different email. Please sign in with the correct account.
                      </span>
                    )}
                  </p>
                  <button className="btn btn-primary w-full" onClick={accept}
                    disabled={loggedInEmail.toLowerCase() !== info.inviteeEmail.toLowerCase()}>
                    Accept invite
                  </button>
                  {loggedInEmail.toLowerCase() !== info.inviteeEmail.toLowerCase() && (
                    <Link href={`/auth/login?next=/invites/${token}`} className="btn btn-ghost w-full mt-2">
                      Sign in with {info.inviteeEmail}
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-[color:var(--muted)] mb-4">
                    You need a Neurogauge account to accept this invite. If you don&apos;t have one, create one with the invited email address (<strong>{info.inviteeEmail}</strong>).
                  </p>
                  <Link href={`/auth/login?next=/invites/${token}`} className="btn btn-primary w-full block text-center">
                    Sign in to accept
                  </Link>
                  <Link href={`/auth/signup?next=/invites/${token}`} className="btn btn-ghost w-full block text-center mt-2">
                    Create account
                  </Link>
                </>
              )}
            </div>
          )}

          {status === "accepting" && (
            <div className="card p-10 text-center text-[color:var(--muted)] text-sm">Accepting invite…</div>
          )}

          {status === "done" && (
            <div className="card p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-[color:var(--success)] mb-4" />
              <h1 className="text-xl font-extrabold">You&apos;re in!</h1>
              <p className="text-sm text-[color:var(--muted)] mt-2">
                You are now a collaborator on <strong>{info?.projectName}</strong>. Redirecting…
              </p>
            </div>
          )}

          {(status === "error" || status === "wrongEmail") && (
            <div className="card p-8 text-center">
              <XCircle className="w-12 h-12 mx-auto text-[color:var(--danger)] mb-4" />
              <h1 className="text-xl font-extrabold">{status === "wrongEmail" ? "Wrong account" : "Error"}</h1>
              <p className="text-sm text-[color:var(--muted)] mt-2">{errorMsg}</p>
              <button onClick={() => setStatus("ready")} className="btn btn-ghost mt-4">Go back</button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
