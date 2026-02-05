import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitDiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface UncommittedChangesSummary {
  staged: GitDiffStats;
  unstaged: GitDiffStats;
  untrackedFiles: number;
  total: GitDiffStats;
}

export interface GitState {
  branch: string | null;
  commitCount: number;
  recentCommits: string[];
  baseBranch: "main" | "master" | null;
  diffFromBase: GitDiffStats;
  uncommitted: UncommittedChangesSummary;
  error: string | null;
}

export interface ReadGitStateOptions {
  recentCommitLimit?: number;
  runGitCommand?: (args: string[]) => Promise<string>;
}

const EMPTY_DIFF_STATS: GitDiffStats = {
  filesChanged: 0,
  insertions: 0,
  deletions: 0,
};

function cloneDiffStats(stats: GitDiffStats): GitDiffStats {
  return {
    filesChanged: stats.filesChanged,
    insertions: stats.insertions,
    deletions: stats.deletions,
  };
}

function defaultUncommittedSummary(): UncommittedChangesSummary {
  return {
    staged: cloneDiffStats(EMPTY_DIFF_STATS),
    unstaged: cloneDiffStats(EMPTY_DIFF_STATS),
    untrackedFiles: 0,
    total: cloneDiffStats(EMPTY_DIFF_STATS),
  };
}

function defaultGitState(error: string | null = null): GitState {
  return {
    branch: null,
    commitCount: 0,
    recentCommits: [],
    baseBranch: null,
    diffFromBase: cloneDiffStats(EMPTY_DIFF_STATS),
    uncommitted: defaultUncommittedSummary(),
    error,
  };
}

function toNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDiffShortStat(raw: string): GitDiffStats {
  if (!raw.trim()) {
    return cloneDiffStats(EMPTY_DIFF_STATS);
  }

  const filesMatch = raw.match(/(\d+)\s+files?\s+changed/);
  const insertionsMatch = raw.match(/(\d+)\s+insertions?\(\+\)/);
  const deletionsMatch = raw.match(/(\d+)\s+deletions?\(-\)/);

  return {
    filesChanged: toNumber(filesMatch?.[1]),
    insertions: toNumber(insertionsMatch?.[1]),
    deletions: toNumber(deletionsMatch?.[1]),
  };
}

function parseCommitCount(raw: string): number {
  return toNumber(raw.trim());
}

function parseCommitMessages(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split("\n")
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
}

function parseUntrackedCount(raw: string): number {
  if (!raw.trim()) {
    return 0;
  }

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function addDiffStats(left: GitDiffStats, right: GitDiffStats): GitDiffStats {
  return {
    filesChanged: left.filesChanged + right.filesChanged,
    insertions: left.insertions + right.insertions,
    deletions: left.deletions + right.deletions,
  };
}

function makeShellGitRunner(projectPath: string): (args: string[]) => Promise<string> {
  return async (args: string[]) => {
    const { stdout } = await execFileAsync("git", args, { cwd: projectPath });
    return stdout.trim();
  };
}

async function resolveBaseBranch(runGitCommand: (args: string[]) => Promise<string>): Promise<"main" | "master" | null> {
  try {
    await runGitCommand(["rev-parse", "--verify", "--quiet", "main"]);
    return "main";
  } catch {
    // Try master next.
  }

  try {
    await runGitCommand(["rev-parse", "--verify", "--quiet", "master"]);
    return "master";
  } catch {
    return null;
  }
}

export async function readGitState(projectPath: string, options: ReadGitStateOptions = {}): Promise<GitState> {
  const commitLimit = Math.max(1, options.recentCommitLimit ?? 5);
  const runGitCommand = options.runGitCommand ?? makeShellGitRunner(projectPath);

  try {
    const branchRaw = await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]);
    const commitCountRaw = await runGitCommand(["rev-list", "--count", "HEAD"]);
    const commitMessagesRaw = await runGitCommand(["log", "--pretty=format:%s", "-n", String(commitLimit)]);

    const baseBranch = await resolveBaseBranch(runGitCommand);
    const diffFromBaseRaw = baseBranch
      ? await runGitCommand(["diff", "--shortstat", `${baseBranch}...HEAD`])
      : "";
    const unstagedRaw = await runGitCommand(["diff", "--shortstat"]);
    const stagedRaw = await runGitCommand(["diff", "--shortstat", "--cached"]);
    const untrackedRaw = await runGitCommand(["ls-files", "--others", "--exclude-standard"]);

    const unstaged = parseDiffShortStat(unstagedRaw);
    const staged = parseDiffShortStat(stagedRaw);
    const untrackedFiles = parseUntrackedCount(untrackedRaw);
    const stagedAndUnstaged = addDiffStats(staged, unstaged);

    return {
      branch: branchRaw || null,
      commitCount: parseCommitCount(commitCountRaw),
      recentCommits: parseCommitMessages(commitMessagesRaw),
      baseBranch,
      diffFromBase: parseDiffShortStat(diffFromBaseRaw),
      uncommitted: {
        staged,
        unstaged,
        untrackedFiles,
        total: {
          filesChanged: stagedAndUnstaged.filesChanged + untrackedFiles,
          insertions: stagedAndUnstaged.insertions,
          deletions: stagedAndUnstaged.deletions,
        },
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown git error";
    return defaultGitState(message);
  }
}
