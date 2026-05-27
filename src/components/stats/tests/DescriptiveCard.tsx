"use client";
import { useState, useMemo } from "react";
import { Variable, VariableCatalog, descriptives, variableLabel, fmt, histogram } from "@/lib/stats";
import { CustomQuestion } from "@/lib/types";
import { VariablePicker } from "../PickSeries";
import { StatTable, CsvDownload } from "../ResultTable";
import { Histogram } from "../Histogram";
import { BoxPlot } from "../BoxPlot";
import { ChartDownload } from "../ChartDownload";
import { useExtract } from "../workspace/WorkspaceProvider";

export function DescriptiveCard({ sessions, catalog, questions }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessions: any[]; catalog: VariableCatalog; questions: CustomQuestion[];
}) {
  const { extractNumeric, extractCategorical } = useExtract();
  const [variable, setVariable] = useState<Variable | null>(null);
  const rows = useMemo(() => variable ? extractNumeric(sessions, variable, questions) : [], [sessions, variable, questions]);
  const stats = useMemo(() => rows.length ? descriptives(rows.map((r) => r.value)) : null, [rows]);

  return (
    <div className="space-y-4">
      <VariablePicker catalog={catalog} value={variable} onChange={setVariable} label="Variable" />
      {!variable && <p className="text-sm text-[color:var(--muted)]">Choose a variable to compute descriptives.</p>}
      {variable && stats && stats.n > 0 && (
        <>
          <p className="text-sm"><span className="font-semibold">{variableLabel(variable, questions)}</span> — n = {stats.n}</p>
          <StatTable rows={[
            { label: "Mean", value: fmt(stats.mean) },
            { label: "Median", value: fmt(stats.median) },
            { label: "Mode", value: stats.mode.length ? stats.mode.map((m) => fmt(m)).join(", ") : "—" },
            { label: "SD", value: fmt(stats.sd) },
            { label: "Variance", value: fmt(stats.variance) },
            { label: "Min / Max", value: `${fmt(stats.min)} / ${fmt(stats.max)}` },
            { label: "Range", value: fmt(stats.range) },
            { label: "Q1 / Q3", value: `${fmt(stats.q1)} / ${fmt(stats.q3)}` },
            { label: "IQR", value: fmt(stats.iqr) },
            { label: "Skewness", value: fmt(stats.skewness) },
            { label: "Kurtosis (excess)", value: fmt(stats.kurtosis) },
            { label: "SEM", value: fmt(stats.sem) },
            { label: "95% CI of mean", value: `[${fmt(stats.ci95Lower)}, ${fmt(stats.ci95Upper)}]` },
          ]} />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Histogram</h5>
              <ChartDownload filename="descriptive_histogram">
                <Histogram bins={histogram(rows.map((r) => r.value))} />
              </ChartDownload>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-[color:var(--muted)] uppercase tracking-wide mb-1">Boxplot</h5>
              <ChartDownload filename="descriptive_boxplot">
                <BoxPlot groups={[{ name: variableLabel(variable, questions), values: rows.map((r) => r.value) }]} />
              </ChartDownload>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <CsvDownload
              filename="descriptives.csv"
              rows={[
                ["statistic", "value"],
                ["n", stats.n], ["mean", stats.mean], ["median", stats.median],
                ["mode", stats.mode.join(";")], ["sd", stats.sd], ["variance", stats.variance],
                ["min", stats.min], ["max", stats.max], ["range", stats.range],
                ["q1", stats.q1], ["q3", stats.q3], ["iqr", stats.iqr],
                ["skewness", stats.skewness], ["kurtosis", stats.kurtosis],
                ["sem", stats.sem],
                ["ci95_lower", stats.ci95Lower], ["ci95_upper", stats.ci95Upper],
              ]}
            />
          </div>
        </>
      )}
      {variable && stats && stats.n === 0 && <p className="text-sm text-[color:var(--muted)]">No usable values found for this variable.</p>}
    </div>
  );
}
