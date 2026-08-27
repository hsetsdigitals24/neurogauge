"use client";
import { useMemo, useState } from "react";
import { Shuffle, Copy, Download, Check, RefreshCw } from "lucide-react";

/**
 * Participant randomization — a dataset-free study-planning tool (sibling of
 * PowerAnalysisCard). It allocates participants to study arms using a seeded,
 * reproducible PRNG, so the same seed always reproduces the same sequence
 * (auditable for trial registration). All computation is client-side; no
 * dataset and no backend round-trip are required.
 */

type Method = "simple" | "block" | "stratified";

interface Arm {
  name: string;
  weight: number;
}

interface Assignment {
  participant: string;
  stratum: string | null;
  arm: string;
}

// ── Seeded PRNG (mulberry32) — deterministic given a 32-bit seed. ───────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle using the supplied PRNG (returns a new array). */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Independent weighted assignment — true "simple" randomization. */
function simpleAllocate(n: number, arms: Arm[], rand: () => number): string[] {
  const sumW = arms.reduce((s, a) => s + a.weight, 0);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let r = rand() * sumW;
    let picked = arms[arms.length - 1].name;
    for (const arm of arms) {
      r -= arm.weight;
      if (r <= 0) { picked = arm.name; break; }
    }
    out.push(picked);
  }
  return out;
}

/**
 * Permuted-block randomization. Each block contains arm names repeated
 * `weight × multiplier` times, shuffled; blocks are laid end-to-end and
 * truncated to n. Guarantees balance (to the ratio) at every block boundary.
 */
function blockAllocate(n: number, arms: Arm[], multiplier: number, rand: () => number): string[] {
  const out: string[] = [];
  while (out.length < n) {
    const pool: string[] = [];
    for (const arm of arms) for (let i = 0; i < arm.weight * multiplier; i++) pool.push(arm.name);
    for (const x of shuffle(pool, rand)) if (out.length < n) out.push(x);
  }
  return out;
}

export function RandomizationCard() {
  // Participant source — either a count, or an explicit pasted ID list.
  const [useList, setUseList] = useState(false);
  const [count, setCount] = useState(60);
  const [idText, setIdText] = useState("");

  const [armsText, setArmsText] = useState("Control, Treatment");
  const [ratioText, setRatioText] = useState("1:1");
  const [method, setMethod] = useState<Method>("block");
  const [blockSize, setBlockSize] = useState(4);
  const [strataText, setStrataText] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));

  const [result, setResult] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Parse arms + ratio into a normalised Arm[]; surface any mismatch.
  const arms = useMemo<Arm[]>(() => {
    const names = armsText.split(",").map((s) => s.trim()).filter(Boolean);
    const ratios = ratioText.split(/[:,]/).map((s) => parseInt(s.trim(), 10));
    return names.map((name, i) => ({
      name,
      weight: Number.isFinite(ratios[i]) && ratios[i] > 0 ? ratios[i] : 1,
    }));
  }, [armsText, ratioText]);

  const sumW = arms.reduce((s, a) => s + a.weight, 0);
  const hasStrata = method === "stratified";

  function run() {
    setError(null);
    setCopied(false);

    if (arms.length < 2) {
      setError("Enter at least two arms, separated by commas (e.g. Control, Treatment).");
      return;
    }
    if (new Set(arms.map((a) => a.name)).size !== arms.length) {
      setError("Arm names must be unique.");
      return;
    }

    // Resolve the participant list.
    let participants: string[];
    if (useList) {
      participants = idText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (participants.length < 2) {
        setError("Paste at least two participant IDs, one per line.");
        return;
      }
      if (new Set(participants).size !== participants.length) {
        setError("Participant IDs must be unique.");
        return;
      }
    } else {
      if (!Number.isFinite(count) || count < 2) {
        setError("Enter a participant count of at least 2.");
        return;
      }
      participants = Array.from({ length: count }, (_, i) => `P${String(i + 1).padStart(3, "0")}`);
    }
    const n = participants.length;

    // Block-size validation (block + stratified both use permuted blocks).
    let multiplier = 1;
    if (method !== "simple") {
      if (blockSize < sumW || blockSize % sumW !== 0) {
        setError(`Block size must be a positive multiple of the ratio sum (${sumW}). Try ${sumW} or ${sumW * 2}.`);
        return;
      }
      multiplier = blockSize / sumW;
    }

    const rand = mulberry32(seed);

    // Optional strata, aligned line-for-line with the participants.
    let strata: (string | null)[] = participants.map(() => null);
    if (hasStrata) {
      const labels = strataText.split(/\r?\n/).map((s) => s.trim());
      const cleaned = labels.filter((s) => s.length > 0);
      if (cleaned.length !== n) {
        setError(`Strata lines (${cleaned.length}) must match the participant count (${n}), one label per participant.`);
        return;
      }
      strata = cleaned;
    }

    // Allocate.
    let arms_out: string[];
    if (method === "simple") {
      arms_out = simpleAllocate(n, arms, rand);
    } else if (method === "block") {
      arms_out = blockAllocate(n, arms, multiplier, rand);
    } else {
      // Stratified: independent permuted-block sequence within each stratum.
      arms_out = new Array<string>(n);
      const byStratum = new Map<string, number[]>();
      strata.forEach((s, i) => {
        const key = s ?? "";
        if (!byStratum.has(key)) byStratum.set(key, []);
        byStratum.get(key)!.push(i);
      });
      for (const idx of byStratum.values()) {
        const seq = blockAllocate(idx.length, arms, multiplier, rand);
        idx.forEach((origIndex, k) => { arms_out[origIndex] = seq[k]; });
      }
    }

    setResult(participants.map((p, i) => ({ participant: p, stratum: strata[i], arm: arms_out[i] })));
  }

  // Summary counts per arm (for the balance readout).
  const counts = useMemo(() => {
    if (!result) return null;
    const m = new Map<string, number>();
    for (const a of arms) m.set(a.name, 0);
    for (const r of result) m.set(r.arm, (m.get(r.arm) ?? 0) + 1);
    return m;
  }, [result, arms]);

  function toCsv(rows: Assignment[]): string {
    const withStrata = rows.some((r) => r.stratum != null);
    const header = withStrata ? ["participant", "stratum", "arm"] : ["participant", "arm"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = rows.map((r) =>
      (withStrata ? [r.participant, r.stratum ?? "", r.arm] : [r.participant, r.arm]).map(esc).join(","),
    );
    return [header.join(","), ...lines].join("\n");
  }

  async function copyCsv() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(toCsv(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — ignore */ }
  }

  function downloadCsv() {
    if (!result) return;
    const blob = new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `randomization-seed-${seed}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--muted)] leading-relaxed">
        Allocate participants to study arms before you collect data. Choose a method and a random
        seed — the same seed always reproduces the same allocation, so the sequence is auditable for
        trial registration. No dataset required.
      </p>

      {/* Participant source */}
      <div>
        <span className="label text-xs">Participants</span>
        <div className="flex flex-wrap gap-3 mt-1 mb-2">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="radio" checked={!useList} onChange={() => setUseList(false)} /> By count
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="radio" checked={useList} onChange={() => setUseList(true)} /> Paste IDs
          </label>
        </div>
        {!useList ? (
          <input
            type="number" step="1" min="2" className="input text-xs"
            value={count} onChange={(e) => setCount(parseInt(e.target.value) || 0)}
          />
        ) : (
          <textarea
            className="input text-xs font-mono h-24" placeholder={"P001\nP002\nP003"}
            value={idText} onChange={(e) => setIdText(e.target.value)}
          />
        )}
      </div>

      {/* Arms */}
      <label className="block">
        <span className="label text-xs">Study arms (comma-separated)</span>
        <input
          type="text" className="input text-xs"
          value={armsText} onChange={(e) => setArmsText(e.target.value)}
          placeholder="Control, Treatment"
        />
      </label>

      {/* Ratio */}
      <label className="block">
        <span className="label text-xs">Allocation ratio</span>
        <input
          type="text" className="input text-xs"
          value={ratioText} onChange={(e) => setRatioText(e.target.value)}
          placeholder="1:1"
        />
        <span className="text-[10px] text-[color:var(--muted)]">
          One weight per arm, e.g. 1:1 (equal) or 2:1. Ratio sum = {sumW}.
        </span>
      </label>

      {/* Method */}
      <div>
        <span className="label text-xs">Method</span>
        <div className="flex flex-wrap gap-3 mt-1">
          {([
            ["simple", "Simple"],
            ["block", "Permuted block"],
            ["stratified", "Stratified"],
          ] as [Method, string][]).map(([m, lbl]) => (
            <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" name="rand-method" checked={method === m} onChange={() => setMethod(m)} />
              {lbl}
            </label>
          ))}
        </div>
        <span className="text-[10px] text-[color:var(--muted)] block mt-1">
          {method === "simple" && "Each participant assigned independently — simplest, but group sizes can drift."}
          {method === "block" && "Balanced to the ratio at every block boundary — the usual choice for trials."}
          {method === "stratified" && "Permuted blocks run separately within each stratum (e.g. site or sex) to keep them balanced."}
        </span>
      </div>

      {/* Block size — for block + stratified */}
      {method !== "simple" && (
        <label className="block">
          <span className="label text-xs">Block size</span>
          <input
            type="number" step={sumW} min={sumW} className="input text-xs"
            value={blockSize} onChange={(e) => setBlockSize(parseInt(e.target.value) || 0)}
          />
          <span className="text-[10px] text-[color:var(--muted)]">
            Must be a multiple of the ratio sum ({sumW}).
          </span>
        </label>
      )}

      {/* Strata — for stratified only */}
      {hasStrata && (
        <label className="block">
          <span className="label text-xs">Strata (one label per participant, aligned)</span>
          <textarea
            className="input text-xs font-mono h-24" placeholder={"SiteA\nSiteA\nSiteB"}
            value={strataText} onChange={(e) => setStrataText(e.target.value)}
          />
        </label>
      )}

      {/* Seed */}
      <label className="block">
        <span className="label text-xs">Random seed</span>
        <div className="flex gap-2">
          <input
            type="number" step="1" min="0" className="input text-xs"
            value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
          />
          <button
            type="button" title="New random seed"
            className="btn btn-ghost text-xs flex items-center gap-1 flex-shrink-0"
            onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </label>

      <div className="pt-1">
        <button className="btn btn-primary text-sm flex items-center gap-1.5" onClick={run}>
          <Shuffle className="w-3.5 h-3.5" /> Randomize
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-xs text-red-700 border border-red-100">{error}</div>
      )}

      {result && counts && (
        <div className="space-y-3">
          {/* Balance summary */}
          <div className="flex flex-wrap gap-2">
            {arms.map((a) => (
              <span key={a.name} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 text-xs font-semibold">
                {a.name}
                <span className="font-normal text-indigo-600">{counts.get(a.name) ?? 0}</span>
              </span>
            ))}
            <span className="inline-flex items-center rounded-full bg-[color:var(--border)]/40 px-2.5 py-1 text-xs text-[color:var(--muted)]">
              n = {result.length} · seed {seed}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={copyCsv}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy CSV"}
            </button>
            <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={downloadCsv}>
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>

          {/* Allocation table */}
          <div className="max-h-72 overflow-auto border border-[color:var(--border)] rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[color:var(--border)]/30">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-semibold">#</th>
                  <th className="px-3 py-1.5 font-semibold">Participant</th>
                  {hasStrata && <th className="px-3 py-1.5 font-semibold">Stratum</th>}
                  <th className="px-3 py-1.5 font-semibold">Arm</th>
                </tr>
              </thead>
              <tbody>
                {result.map((r, i) => (
                  <tr key={r.participant} className="border-t border-[color:var(--border)]">
                    <td className="px-3 py-1 text-[color:var(--muted)]">{i + 1}</td>
                    <td className="px-3 py-1 font-mono">{r.participant}</td>
                    {hasStrata && <td className="px-3 py-1">{r.stratum}</td>}
                    <td className="px-3 py-1 font-semibold">{r.arm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
