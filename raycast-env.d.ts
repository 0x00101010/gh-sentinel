/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
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
  /** Preferences accessible in the `sentinel-menu-bar` command */
  export type SentinelMenuBar = ExtensionPreferences & {}
  /** Preferences accessible in the `configure-watched-repos` command */
  export type ConfigureWatchedRepos = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `sentinel-menu-bar` command */
  export type SentinelMenuBar = {}
  /** Arguments passed to the `configure-watched-repos` command */
  export type ConfigureWatchedRepos = {}
}

