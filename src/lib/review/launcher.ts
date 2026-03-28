import { homedir } from "os";
import { join } from "path";
import { exec } from "../exec";

const OPENCODE = join(homedir(), ".opencode/bin/opencode");
const SRC_ROOT = join(homedir(), "src");

function bareRoot(repo: string): string {
  return join(SRC_ROOT, repo);
}

function worktreePath(repo: string, prNumber: number): string {
  return join(bareRoot(repo), "pr", String(prNumber));
}

async function ensureWorktree(repo: string, prNumber: number): Promise<string> {
  const wt = worktreePath(repo, prNumber);
  const bare = bareRoot(repo);
  const branch = `pr/${prNumber}`;

  try {
    await exec(`test -d "${wt}"`);
  } catch {
    try {
      await exec(`git worktree add "${wt}" -b "${branch}"`, { timeout: 30_000, cwd: bare });
    } catch {
      await exec(`git worktree add "${wt}" "${branch}"`, { timeout: 30_000, cwd: bare });
    }
  }

  return wt;
}

export async function openReview(repo: string, prNumber: number): Promise<void> {
  const wt = await ensureWorktree(repo, prNumber);
  const prNum = String(prNumber);
  const windowName = `pr/${prNum}`;

  await exec(`tmux new-window -c "${wt}" -n "${windowName}"`);
  await exec(`tmux send-keys -t "${windowName}" "${OPENCODE} pr ${prNum}" Enter`);
}
