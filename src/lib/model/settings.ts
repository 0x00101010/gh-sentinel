export interface WatchedRepo {
  repo: string;
  notify: boolean;
}

export interface Preferences {
  reviewCommand: "claude" | "opencode";
  reviewPrompt: string;
  terminalNotifierPath: string;
}
