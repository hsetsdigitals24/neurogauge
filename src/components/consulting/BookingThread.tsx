"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { notify } from "@/lib/toast";

interface Message { id: string; body: string; senderId: string; createdAt: string; sender: { name: string } }

// Per-booking message thread, shared by the client bookings page and the
// consultant console.
export function BookingThread({ bookingId }: { bookingId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string>("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  function load() {
    return fetch(`/api/marketplace/bookings/${bookingId}/messages`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => { setMessages(d.messages ?? []); setMeId(d.meId ?? ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/marketplace/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not send"); return; }
      setMessages((m) => [...m, d.message]);
      setText("");
    } catch {
      notify.error("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <p className="text-xs text-[color:var(--muted)]">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[color:var(--muted)]">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {!mine && <div className="text-[10px] font-semibold opacity-70">{m.sender.name}</div>}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className="btn btn-primary btn-sm" disabled={sending || !text.trim()} onClick={send}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
