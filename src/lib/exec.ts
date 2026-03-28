import { exec as cpExec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(cpExec);

const PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  process.env.PATH,
].join(":");

const baseEnv = { ...process.env, PATH };

export async function exec(
  cmd: string,
  opts?: { maxBuffer?: number; timeout?: number; cwd?: string },
): Promise<string> {
  const { stdout } = await execPromise(cmd, {
    encoding: "utf-8",
    env: baseEnv,
    ...opts,
  });
  return stdout;
}
