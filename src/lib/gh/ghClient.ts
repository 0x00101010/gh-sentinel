import { exec } from "../exec";

export async function ghRest<T>(endpoint: string): Promise<T> {
  const raw = await exec(`gh api "${endpoint}"`, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 15_000,
  });
  return JSON.parse(raw) as T;
}

export async function ghGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const args = [`-f query='${query.replace(/'/g, "'\\''")}'`];
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      args.push(`-f ${key}='${String(value).replace(/'/g, "'\\''")}'`);
    }
  }
  const raw = await exec(`gh api graphql ${args.join(" ")}`, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 15_000,
  });
  return JSON.parse(raw) as T;
}

export async function ghMarkThreadRead(threadId: string): Promise<void> {
  await exec(`gh api --method PATCH notifications/threads/${threadId}`, {
    timeout: 10_000,
  });
}

export async function ghMarkAllRead(): Promise<void> {
  await exec(`gh api --method PUT notifications --field read=true`, {
    timeout: 10_000,
  });
}
