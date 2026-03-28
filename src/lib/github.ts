import { Cache, getPreferenceValues } from "@raycast/api";
import { exec } from "./exec";
import type {
  GitHubNotification,
  ParsedNotification,
  NotificationCategory,
  NotificationGroup,
  GroupedByRepo,
  Preferences,
} from "../types";

const cache = new Cache();
const SEEN_IDS_KEY = "seen-notification-ids";
const MAX_SEEN = 500;

export function fetchNotifications(): GitHubNotification[] {
  const raw = exec('gh api "notifications?per_page=50"', {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 15_000,
  });
  return JSON.parse(raw) as GitHubNotification[];
}

export function markAsRead(threadId: string): void {
  exec(`gh api --method PATCH notifications/threads/${threadId}`, {
    timeout: 10_000,
  });
}

export function markAllAsRead(): void {
  exec(`gh api --method PUT notifications --field read=true`, {
    timeout: 10_000,
  });
}

function categorize(reason: string): NotificationCategory {
  if (reason === "review_requested") return "review_requested";
  if (reason === "mention" || reason === "team_mention") return "mentions";
  return "replies";
}

function subjectApiUrlToHtml(apiUrl: string | null, repo: string): string {
  if (!apiUrl) return `https://github.com/${repo}`;
  return apiUrl
    .replace("https://api.github.com/repos/", "https://github.com/")
    .replace("/pulls/", "/pull/");
}

function extractPrNumber(apiUrl: string | null): number | null {
  if (!apiUrl) return null;
  const match = apiUrl.match(/\/pulls\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function parseNotification(n: GitHubNotification): ParsedNotification {
  return {
    id: n.id,
    title: n.subject.title,
    repo: n.repository.full_name,
    repoUrl: n.repository.html_url,
    htmlUrl: subjectApiUrlToHtml(n.subject.url, n.repository.full_name),
    category: categorize(n.reason),
    reason: n.reason,
    subjectType: n.subject.type,
    prNumber: extractPrNumber(n.subject.url),
    updatedAt: n.updated_at,
    ownerAvatar: n.repository.owner.avatar_url,
  };
}

export function filterByWatchedRepos(notifications: ParsedNotification[]): ParsedNotification[] {
  const { repos } = getPreferenceValues<Preferences>();
  if (!repos || repos.trim() === "") return notifications;

  const watched = new Set(
    repos
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean),
  );
  return notifications.filter((n) => watched.has(n.repo.toLowerCase()));
}

const CATEGORY_ORDER: NotificationCategory[] = ["review_requested", "mentions", "replies"];
const CATEGORY_META: Record<NotificationCategory, { label: string; icon: string }> = {
  review_requested: { label: "Requested for Review", icon: "\u{1F534}" },
  mentions: { label: "Mentions", icon: "\u{1F4AC}" },
  replies: { label: "Replies", icon: "\u21A9\uFE0F" },
};

export function groupNotifications(notifications: ParsedNotification[]): NotificationGroup[] {
  const byCategory = new Map<NotificationCategory, Map<string, ParsedNotification[]>>();

  for (const n of notifications) {
    if (!byCategory.has(n.category)) {
      byCategory.set(n.category, new Map());
    }
    const repoMap = byCategory.get(n.category)!;
    if (!repoMap.has(n.repo)) {
      repoMap.set(n.repo, []);
    }
    repoMap.get(n.repo)!.push(n);
  }

  return CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => {
    const repoMap = byCategory.get(cat)!;
    const flat: ParsedNotification[] = [];
    for (const items of repoMap.values()) {
      flat.push(...items);
    }
    return {
      category: cat,
      ...CATEGORY_META[cat],
      notifications: flat,
    };
  });
}

export function groupByRepo(notifications: ParsedNotification[]): GroupedByRepo[] {
  const byRepo = new Map<string, ParsedNotification[]>();
  for (const n of notifications) {
    if (!byRepo.has(n.repo)) {
      byRepo.set(n.repo, []);
    }
    byRepo.get(n.repo)!.push(n);
  }
  return Array.from(byRepo.entries()).map(([repo, items]) => ({
    repo,
    repoUrl: items[0].repoUrl,
    notifications: items,
  }));
}

export function getSeenIds(): Set<string> {
  const raw = cache.get(SEEN_IDS_KEY);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

export function updateSeenIds(currentIds: string[]): void {
  const existing = getSeenIds();
  for (const id of currentIds) {
    existing.add(id);
  }
  const trimmed = [...existing].slice(-MAX_SEEN);
  cache.set(SEEN_IDS_KEY, JSON.stringify(trimmed));
}
