import { execSync, type ExecSyncOptionsWithStringEncoding } from "child_process";

const PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  process.env.PATH,
].join(":");

const baseEnv = { ...process.env, PATH };

export function exec(cmd: string, opts?: Partial<ExecSyncOptionsWithStringEncoding>): string {
  return execSync(cmd, {
    encoding: "utf-8",
    env: baseEnv,
    ...opts,
  });
}
