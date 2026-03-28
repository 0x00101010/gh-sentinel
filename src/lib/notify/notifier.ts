import { getPreferenceValues } from "@raycast/api";
import { exec } from "../exec";
import type { Preferences } from "../model/settings";

interface NotifyOptions {
  title: string;
  subtitle?: string;
  message: string;
  openUrl?: string;
  sound?: string;
  group?: string;
}

export async function notify(opts: NotifyOptions): Promise<void> {
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
    await exec(`${terminalNotifierPath} ${args.join(" ")}`, { timeout: 5_000 });
  } catch {
    // terminal-notifier may not be installed
  }
}

function escape(s: string): string {
  return s.replace(/"/g, '\\"');
}
