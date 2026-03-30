<p align="center">
    <img src="./assets/command-icon.png" alt="GitHub Sentinel" width="128">
</p>

<h1 align="center">GitHub Sentinel</h1>

<h4 align="center">
    Unified GitHub triage in your menu bar. Built as a Raycast extension.
</h4>

<p align="center">
  <a href="https://github.com/francis/gh-sentinel/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-d1d1f6.svg?style=flat&labelColor=1C2C2E&color=a78bfa&logo=googledocs&logoColor=white" alt="License"></a>
  <img src="https://img.shields.io/badge/Raycast-Extension-FF6363.svg?style=flat&labelColor=1C2C2E&logo=raycast&logoColor=white" alt="Raycast">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=flat&labelColor=1C2C2E&logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <a href="#whats-sentinel">What's Sentinel?</a> •
  <a href="#features">Features</a> •
  <a href="#install">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#license">License</a>
</p>

> [!IMPORTANT]
> Sentinel uses the `gh` CLI for all GitHub API calls — no OAuth tokens needed. Make sure `gh` is installed and authenticated.

## What's Sentinel?

GitHub Sentinel is a Raycast menu bar extension that consolidates your GitHub notifications, pull requests, and issues into a single, priority-scored triage list. Instead of juggling multiple tabs and notification streams, Sentinel surfaces what matters most with smart priority scoring and repo-level organization.

## Features

- **Unified triage** — PRs, issues, and notifications from four GitHub data sources merged and deduplicated into one list
- **Priority scoring** — Items ranked by reason: review requested (100), assigned (70), mentioned (50), CI failing (30), watched repo (10), and more
- **Repo scanning** — Automatically scans pinned and watched repos for open items updated in the last 14 days, filtering out draft PRs
- **Collapsible repo groups** — Unpinned repos collapse into expandable submenus; pinned repos show items immediately with a top-10 inline limit and "show more" overflow
- **PR & Issue subsections** — Items within each repo are split into "Pull Requests" and "Issues" sections
- **Pin / Hide repos** — Pin important repos to the top (📌) for instant access, hide noisy repos in a collapsed section
- **Dismiss items** — ⌥-click any item to dismiss it permanently across all data sources
- **Native notifications** — Per-repo macOS notifications via `terminal-notifier` with deduplication
- **Configurable watched repos** — Select repos to monitor and toggle notification preferences per repo
- **Stale-while-revalidate cache** — Renders previous snapshot instantly while refreshing in the background; items persist across refreshes
- **GitHub-style icons** — PR and issue state icons (open, closed, merged, draft) matching Raycast's GitHub extension aesthetic

## Install

### Prerequisites

- [Raycast](https://raycast.com) installed
- [`gh` CLI](https://cli.github.com) installed and authenticated (`gh auth login`)
- [`terminal-notifier`](https://github.com/julienXX/terminal-notifier) for native notifications (optional)
  ```sh
  brew install terminal-notifier
  ```

### Build & Install

```sh
git clone https://github.com/francis/gh-sentinel.git
cd gh-sentinel
bun install
just b
```

The extension will appear in Raycast after building. You can also run `just dev` for development mode with hot reload.

## Usage

### Commands

| Command | Mode | Description |
|---------|------|-------------|
| **Sentinel** | Menu Bar (1m interval) | Triage menu bar icon with item count, grouped by repo |
| **Configure Watched Repos** | View | Select repos to watch and configure per-repo notifications |

### Menu Bar Layout

**Pinned repos** appear at the top with items listed immediately:
- Top 10 items shown inline (PRs first, then issues), sorted by priority
- Overflow items accessible via "N more in repo…" submenu
- Sections labeled `📌 org/repo — PRs` and `📌 org/repo — Issues`

**Unpinned repos** appear as collapsible submenus showing `org/repo (count)`:
- Click to expand into "Pull Requests" and "Issues" subsections
- Pin / Hide actions at the bottom of each submenu

**Hidden repos** are collapsed under a "Hidden" section at the bottom.

### Interactions

| Action | Trigger | Description |
|--------|---------|-------------|
| Open in browser | Click item | Opens PR/issue on GitHub |
| Dismiss item | ⌥ + Click item | Permanently hides the item from all sources |
| Pin / Unpin repo | Click action in repo group | Pinned repos show items inline at the top |
| Hide repo | Click action in repo group | Moves repo to collapsed "Hidden" section |
| Unhide repo | Click action in hidden submenu | Restores repo to visible list |
| Mark All as Read | Click global action | Marks all GitHub notifications as read |
| Clear Cache & Refresh | Click global action | Clears cached data and forces a full refresh |

### Preferences

| Preference | Description | Default |
|------------|-------------|---------|
| Review CLI | CLI tool for PR review (`claude` or `opencode`) | `claude` |
| Review Prompt | Prompt template with `{diff}` placeholder | Review for bugs, security, design |
| terminal-notifier Path | Path to `terminal-notifier` binary | `/opt/homebrew/bin/terminal-notifier` |

### Justfile Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `just build` | `just b` | Build the extension |
| `just dev` | `just d` | Start development mode |
| `just lint` | `just l` | Run linter |
| `just typecheck` | `just t` | Run TypeScript type checking |
| `just fix` | `just f` | Auto-fix lint issues |

## Architecture

Sentinel refreshes on a 1-minute interval, pulling from four GitHub data sources in parallel:

1. **Notifications API** — `gh api /notifications` for subscribed activity
2. **Review Requests** — GraphQL search for `is:pr is:open review-requested:@me`
3. **Assignments** — GraphQL search for `is:open assignee:@me`
4. **Repo Scan** — GraphQL search for open items in pinned/watched repos updated in the last 14 days (draft PRs excluded, batched in groups of 10)

Items are deduplicated, enriched with PR/issue metadata via batched GraphQL, filtered (dismissed items, closed/merged items), scored by priority, and grouped by repository.

### Priority Scoring

| Reason | Score |
|--------|-------|
| Review requested | 100 |
| Assigned | 70 |
| Mentioned | 50 |
| CI failing | 30 |
| Watched repo (new) | 10 |
| Author | 5 |
| Subscribed | 1 |

### Dismiss Behavior

Dismissed items are stored by `repo:number` key, ensuring an item stays dismissed regardless of which data source surfaces it (notification, search, or scan). Dismissals persist across refreshes. Use "Clear Cache & Refresh" to reset.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
