import { getPreferenceValues } from "@raycast/api";
import { execSync } from "child_process";
import type { Preferences } from "../types";

interface NotifyOptions {
  title: string;
  subtitle?: string;
  message: string;
  openUrl?: string;
  sound?: string;
  group?: string;
}

export function notify(opts: NotifyOptions): void {
  const { terminalNotifierPath } = getPreferenceValues<Preferences>();
  const args = [
    `-title "${escape(opts.title)}"`,
    `-message "${escape(opts.message)}"`,
  ];

  if (opts.subtitle) args.push(`-subtitle "${escape(opts.subtitle)}"`);
  if (opts.openUrl) args.push(`-open "${opts.openUrl}"`);
  if (opts.sound) args.push(`-sound ${opts.sound}`);
  if (opts.group) args.push(`-group "${escape(opts.group)}"`);

  try {
    execSync(`${terminalNotifierPath} ${args.join(" ")}`, { timeout: 5_000 });
  } catch {
    // terminal-notifier may not be installed — fail silently
  }
}

function escape(s: string): string {
  return s.replace(/"/g, '\\"');
}
