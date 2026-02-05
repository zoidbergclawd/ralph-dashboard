"use client";

import React, { useMemo } from "react";

interface MetricsPanelProps {
  totalLoc: number;
  startLoc?: number | null;
  fileCount: number;
  testCount: number;
  coveragePct: number | null;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function coverageTone(coveragePct: number | null): "red" | "yellow" | "green" | "none" {
  if (coveragePct === null || !Number.isFinite(coveragePct)) {
    return "none";
  }

  if (coveragePct < 60) {
    return "red";
  }

  if (coveragePct < 80) {
    return "yellow";
  }

  return "green";
}

export default function MetricsPanel({ totalLoc, startLoc = null, fileCount, testCount, coveragePct }: MetricsPanelProps) {
  const locDelta = useMemo(() => {
    if (startLoc === null || !Number.isFinite(startLoc)) {
      return null;
    }

    return totalLoc - startLoc;
  }, [startLoc, totalLoc]);

  const coverage = useMemo(() => {
    const tone = coverageTone(coveragePct);
    const rounded = coveragePct === null || !Number.isFinite(coveragePct) ? null : Math.round(coveragePct);

    if (tone === "red") {
      return {
        badgeClass: "border-red-500/40 bg-red-500/10 text-red-700",
        value: `${rounded}%`,
      };
    }

    if (tone === "yellow") {
      return {
        badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-700",
        value: `${rounded}%`,
      };
    }

    if (tone === "green") {
      return {
        badgeClass: "border-green-500/40 bg-green-500/10 text-green-700",
        value: `${rounded}%`,
      };
    }

    return {
      badgeClass: "border-border bg-background text-muted-foreground",
      value: "N/A",
    };
  }, [coveragePct]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
      <h2 className="text-lg font-semibold">Metrics</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total LOC</p>
          <p className="mt-1 text-xl font-semibold">{formatInteger(totalLoc)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {locDelta === null
              ? "No baseline available"
              : `${locDelta >= 0 ? "+" : ""}${formatInteger(locDelta)} from start`}
          </p>
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Files</p>
          <p className="mt-1 text-xl font-semibold">{formatInteger(fileCount)}</p>
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tests</p>
          <p className="mt-1 text-xl font-semibold">{formatInteger(testCount)}</p>
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage</p>
          <p
            aria-label="Coverage percentage"
            className={`mt-1 inline-flex rounded border px-2 py-1 text-sm font-semibold ${coverage.badgeClass}`}
          >
            {coverage.value}
          </p>
        </div>
      </div>
    </section>
  );
}
