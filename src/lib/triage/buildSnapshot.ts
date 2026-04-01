import { dismissKey, type TriageItem, type TriageSnapshot } from "../model/triage";
import { ghRest, ghGraphQL } from "../gh/ghClient";
import {
  SEARCH_REVIEW_REQUESTED,
  SEARCH_ASSIGNED,
  buildPrDetailQuery,
  buildIssueDetailQuery,
  buildRepoScanQuery,
  type GitHubNotification,
  type SearchResult,
  type PrDetailResult,
  type IssueDetailResult,
} from "../gh/queries";
import { mapNotification, mapSearchNode } from "../gh/mappers";
import { scoreAndSort } from "./scoring";
import { getWatchedRepoSet, getPinnedRepos, getDismissedIds } from "../storage/local";
import { getCachedSnapshot } from "../storage/cache";

function mergeItems(sources: TriageItem[][]): TriageItem[] {
  const byKey = new Map<string, TriageItem>();

  for (const items of sources) {
    for (const item of items) {
      const key = dismissKey(item);
      const existing = byKey.get(key);
      if (existing) {
        const reasonSet = new Set([...existing.reasons, ...item.reasons]);
        existing.reasons = [...reasonSet];
        if (item.threadId && !existing.threadId) {
          existing.threadId = item.threadId;
        }
        if (item.author && !existing.author) {
          existing.author = item.author;
          existing.avatarUrl = item.avatarUrl;
        }
        if (item.isDraft) existing.isDraft = true;
      } else {
        byKey.set(key, { ...item });
      }
    }
  }

  return [...byKey.values()];
}

async function enrichItems(items: TriageItem[]): Promise<void> {
  const prs = items.filter((item) => item.kind === "pr");
  const issues = items.filter((item) => item.kind === "issue");

  const promises: Promise<void>[] = [];

  if (prs.length > 0) {
    promises.push(
      ghGraphQL<PrDetailResult>(buildPrDetailQuery(prs.map((p) => ({ repo: p.repo, number: p.number }))))
        .then((result) => {
          for (let i = 0; i < prs.length; i++) {
            const data = result.data[`pr${i}`]?.pullRequest;
            if (!data) {
              prs[i].state = "closed";
              continue;
            }
            const pr = prs[i];
            if (data.state === "MERGED") pr.state = "merged";
            else if (data.state === "CLOSED") pr.state = "closed";
            else pr.state = "open";
            pr.isDraft = data.isDraft;
            if (data.author && !pr.author) {
              pr.author = data.author.login;
              pr.avatarUrl = data.author.avatarUrl;
            }
          }
        })
        .catch(() => {}),
    );
  }

  if (issues.length > 0) {
    promises.push(
      ghGraphQL<IssueDetailResult>(buildIssueDetailQuery(issues.map((iss) => ({ repo: iss.repo, number: iss.number }))))
        .then((result) => {
          for (let i = 0; i < issues.length; i++) {
            const data = result.data[`issue${i}`]?.issue;
            if (!data) {
              issues[i].state = "closed";
              continue;
            }
            const issue = issues[i];
            if (data.state === "CLOSED") issue.state = "closed";
            else issue.state = "open";
            if (data.author && !issue.author) {
              issue.author = data.author.login;
              issue.avatarUrl = data.author.avatarUrl;
            }
          }
        })
        .catch(() => {}),
    );
  }

  await Promise.all(promises);
}

const SCAN_LOOKBACK_DAYS = 14;
const SCAN_BATCH_SIZE = 10;

function sinceDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function scanWatchedRepos(repos: string[]): Promise<TriageItem[]> {
  if (repos.length === 0) return [];

  const since = sinceDate(SCAN_LOOKBACK_DAYS);
  const batches: string[][] = [];
  for (let i = 0; i < repos.length; i += SCAN_BATCH_SIZE) {
    batches.push(repos.slice(i, i + SCAN_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      ghGraphQL<SearchResult>(buildRepoScanQuery(batch, since)).catch(() => null),
    ),
  );

  const items: TriageItem[] = [];
  for (const result of results) {
    if (!result) continue;
    for (const node of result.data.search.nodes) {
      items.push(mapSearchNode(node, "watched"));
    }
  }
  return items;
}

export async function buildSnapshot(): Promise<TriageSnapshot> {
  const watchedRepos = await getWatchedRepoSet();
  const hasFilter = watchedRepos.size > 0;

  const [notifications, reviewRequested, assigned] = await Promise.all([
    ghRest<GitHubNotification[]>("notifications?per_page=50").catch(() => []),
    ghGraphQL<SearchResult>(SEARCH_REVIEW_REQUESTED).catch(() => null),
    ghGraphQL<SearchResult>(SEARCH_ASSIGNED).catch(() => null),
  ]);

  const notifItems = notifications
    .map(mapNotification)
    .filter((item): item is TriageItem => item !== null);

  const reviewItems = reviewRequested?.data.search.nodes.map((n) => mapSearchNode(n, "review")) ?? [];
  const assignedItems = assigned?.data.search.nodes.map((n) => mapSearchNode(n, "assigned")) ?? [];

  const pinnedRepos = await getPinnedRepos();
  const scanSet = new Set<string>([...watchedRepos, ...pinnedRepos.map((r) => r.toLowerCase())]);
  const scanned = (await scanWatchedRepos([...scanSet])).filter((item) => !item.isDraft);

  const cachedItems = getCachedSnapshot()?.items ?? [];

  let merged = mergeItems([cachedItems, notifItems, reviewItems, assignedItems, scanned]);

  if (hasFilter) {
    merged = merged.filter((item) => watchedRepos.has(item.repo.toLowerCase()));
  }

  await enrichItems(merged);

  const dismissedKeys = await getDismissedIds();
  merged = merged.filter((item) => item.state === "open" && !dismissedKeys.has(dismissKey(item)));
  const scored = scoreAndSort(merged);

  return {
    items: scored,
    fetchedAt: Date.now(),
  };
}
