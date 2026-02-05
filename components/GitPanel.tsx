"use client";

import React, { useState } from "react";

import type { GitState } from "@/lib/git-state";

type GitPanelData = Pick<GitState, "branch" | "commitCount" | "recentCommits" | "baseBranch" | "diffFromBase" | "error">;

interface GitPanelProps {
  git: GitPanelData;
}

export default function GitPanel({ git }: GitPanelProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const commitsToShow = git.recentCommits.slice(0, 5);
  const canCopyBranch = Boolean(git.branch);
  const diffLabel = git.baseBranch ? `Diff vs ${git.baseBranch}` : "Diff summary";

  const handleCopyBranch = async () => {
    if (!git.branch) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(git.branch);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-6">
      <h2 className="text-lg font-semibold">Git State</h2>

      <div className="mt-4 rounded-md border border-border bg-background/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Branch</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium">{git.branch ?? "Detached / unavailable"}</p>
          <button
            type="button"
            onClick={handleCopyBranch}
            disabled={!canCopyBranch}
            className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Copy branch name"
          >
            Copy
          </button>
        </div>
        {copyStatus === "copied" ? <p className="mt-2 text-xs text-green-600">Copied.</p> : null}
        {copyStatus === "error" ? <p className="mt-2 text-xs text-red-600">Unable to copy.</p> : null}
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Commits</p>
        <p className="mt-1 text-sm font-medium">{git.commitCount} commits on this branch</p>
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{diffLabel}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Files</p>
            <p className="font-semibold">{git.diffFromBase.filesChanged}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">+ Lines</p>
            <p className="font-semibold">{git.diffFromBase.insertions}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">- Lines</p>
            <p className="font-semibold">{git.diffFromBase.deletions}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/50 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent commits</p>
        {commitsToShow.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {commitsToShow.map((commit) => (
              <li key={commit}>{commit}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No commits available.</p>
        )}
      </div>

      {git.error ? <p className="mt-4 text-xs text-red-600">Git error: {git.error}</p> : null}
    </section>
  );
}
