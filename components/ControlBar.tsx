"use client";

import React, { useMemo, useState } from "react";

interface ControlBarProps {
  projectPath?: string;
  initialStatus?: "running" | "stopped";
}

type RunStatus = "running" | "stopped";
type Agent = "codex" | "claude";

interface ApiError {
  error?: string;
}

const AGENT_OPTIONS: Array<{ value: Agent; label: string }> = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude" },
];

const TEAM_SIZE_OPTIONS = ["1", "2", "3", "4", "5"];

function buildFlags(agent: Agent, teamSize: string): string[] {
  return ["--agent", agent, "--team", teamSize];
}

function toRunUrl(action: "start" | "resume", projectPath: string): string {
  return `/api/run/${action}?projectPath=${encodeURIComponent(projectPath)}`;
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiError;
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // Fallback to generic message below.
  }

  return "Run action failed.";
}

export default function ControlBar({ projectPath, initialStatus = "stopped" }: ControlBarProps) {
  const [agent, setAgent] = useState<Agent>("codex");
  const [teamSize, setTeamSize] = useState("2");
  const [status, setStatus] = useState<RunStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRunActions = useMemo(() => Boolean(projectPath && projectPath.trim().length > 0), [projectPath]);

  const performStartLikeAction = async (action: "start" | "resume"): Promise<void> => {
    if (!projectPath) {
      setError("Project path is required to run Ralph.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(toRunUrl(action, projectPath), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectPath,
          flags: buildFlags(agent, teamSize),
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setStatus("running");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Run action failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = async (): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/run/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      setStatus("stopped");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Run action failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Mission Control</h2>
        <p className="text-sm">
          Status:{" "}
          <span className={status === "running" ? "font-semibold text-green-400" : "font-semibold text-muted-foreground"}>
            {status === "running" ? "Running" : "Stopped"}
          </span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Agent</span>
          <select
            aria-label="Agent"
            value={agent}
            onChange={(event) => setAgent(event.target.value as Agent)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {AGENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Team Size</span>
          <select
            aria-label="Team Size"
            value={teamSize}
            onChange={(event) => setTeamSize(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {TEAM_SIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => performStartLikeAction("start")}
            disabled={isSubmitting || !canRunActions}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Start
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={isSubmitting}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => performStartLikeAction("resume")}
            disabled={isSubmitting || !canRunActions}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            Resume
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      {!canRunActions ? (
        <p className="mt-3 text-sm text-muted-foreground">Project path is required to start or resume a run.</p>
      ) : null}
    </section>
  );
}
