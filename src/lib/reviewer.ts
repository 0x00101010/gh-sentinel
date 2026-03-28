import { getPreferenceValues } from "@raycast/api";
import { execSync } from "child_process";
import type { Preferences, ReviewResult } from "../types";

export function fetchDiff(repo: string, prNumber: number): string {
  return execSync(`gh pr diff ${prNumber} --repo ${repo}`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30_000,
  });
}

export function runReview(repo: string, prNumber: number): ReviewResult {
  const { reviewCommand, reviewPrompt } = getPreferenceValues<Preferences>();

  let diff: string;
  try {
    diff = fetchDiff(repo, prNumber);
  } catch (e) {
    return { status: "error", error: `Failed to fetch diff: ${e}` };
  }

  if (diff.length > 100_000) {
    diff = diff.slice(0, 100_000) + "\n\n[... diff truncated at 100KB ...]";
  }

  const prompt = reviewPrompt.replace("{diff}", diff);
  const cmd = reviewCommand === "opencode" ? "opencode" : "claude";

  try {
    const body = execSync(`echo ${shellQuote(prompt)} | ${cmd} --print`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 5 * 60_000,
    });
    return { status: "done", body: body.trim() };
  } catch (e) {
    return { status: "error", error: `Review failed: ${e}` };
  }
}

export function postReview(repo: string, prNumber: number, body: string): void {
  execSync(`gh pr review ${prNumber} --repo ${repo} --comment --body ${shellQuote(body)}`, {
    timeout: 30_000,
  });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
