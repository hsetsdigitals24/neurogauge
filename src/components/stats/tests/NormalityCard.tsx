"use client";
import { useState, useMemo } from "react";
import { Variable, VariableCatalog, shapiroWilk, ksNormal, histogram, qqNormalPoints, fmt, fmtP, variableLabel } from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { Histogram } from "../Histogram";
import { QQPlot } from "../QQPlot";
import { useExtract } from "../workspace/WorkspaceProvider";

export function NormalityCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [variable, setVariable] = useState<Variable | null>(null);
  const values = useMemo(() => variable ? extractNumeric(sessions, variable, questions).map((r) => r.value) : [],
    [sessions, variable, questions]);
  const sw = useMemo(() => values.length ? shapiroWilk(values) : null, [values]);
  const ks = useMemo(() => values.length ? ksNormal(values) : null, [values]);
  const bins = useMemo(() => histogram(values), [values]);
  const qq = useMemo(() => qqNormalPoints(values), [values]);

  return (
    <div className="space-y-4">
      <VariablePicker catalog={catalog} value={variable} onChange={setVariable} label="Variable" />
      {variable && values.length >= 3 && sw && ks && (
        <>
          <p className="text-sm font-semibold">{variableLabel(variable, questions)} — n = {values.length}</p>
          <StatTable rows={[
            { label: "Shapiro-Wilk W", value: fmt(sw.statistic, 4) },
            { label: "Shapiro-Wilk p", value: `${fmtP(sw.pValue)} ${sw.reject05 ? "(reject normality)" : "(consistent with normal)"}` },
            { label: "Kolmogorov-Smirnov D", value: fmt(ks.statistic, 4) },
            { label: "Kolmogorov-Smirnov p", value: `${fmtP(ks.pValue)} ${ks.reject05 ? "(reject normality)" : "(consistent with normal)"}` },
          ]} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Histogram</h5>
              <Histogram bins={bins} />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Q–Q plot (vs Normal)</h5>
              <QQPlot points={qq} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload filename="normality.csv" rows={[
              ["test", "statistic", "p_value"],
              ["shapiro-wilk", sw.statistic, sw.pValue],
              ["kolmogorov-smirnov", ks.statistic, ks.pValue],
            ]} />
          </div>
        </>
      )}
      {variable && values.length < 3 && <p className="text-sm text-[color:var(--muted)]">Need at least 3 values.</p>}
      {!variable && <p className="text-sm text-[color:var(--muted)]">Pick a numeric variable.</p>}
    </div>
  );
}
