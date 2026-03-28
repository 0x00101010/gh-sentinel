/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Watched Repos - Comma-separated owner/repo list (empty = all) */
  "repos": string,
  /** Poll Interval - Minutes between notification polls */
  "pollInterval": "1" | "2" | "5" | "10" | "15" | "30",
  /** Review CLI - CLI tool for LLM review */
  "reviewCommand": "claude" | "opencode",
  /** Review Prompt - Prompt template with {diff} placeholder */
  "reviewPrompt": string,
  /** terminal-notifier Path - Path to terminal-notifier binary */
  "terminalNotifierPath": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `pr-watch` command */
  export type PrWatch = ExtensionPreferences & {}
  /** Preferences accessible in the `review-prs` command */
  export type ReviewPrs = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `pr-watch` command */
  export type PrWatch = {}
  /** Arguments passed to the `review-prs` command */
  export type ReviewPrs = {}
}

