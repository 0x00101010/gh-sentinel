import {
  dismissKey,
  type TriageItem,
  type TriageSnapshot,
} from "../model/triage";
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
import {
  getWatchedRepoSet,
  getPinnedRepos,
  getDismissedIds,
} from "../storage/local";


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

const ENRICH_BATCH_SIZE = 25;

async function enrichPrBatch(batch: TriageItem[]): Promise<void> {
  try {
    const result = await ghGraphQL<PrDetailResult>(
      buildPrDetailQuery(
        batch.map((p) => ({ repo: p.repo, number: p.number })),
      ),
    );
    if (!result?.data) {
      console.error("gh-sentinel: PR enrichment returned no data", result);
      return;
    }
    for (let i = 0; i < batch.length; i++) {
      const data = result.data[`pr${i}`]?.pullRequest;
      if (!data) {
        batch[i].state = "closed";
        continue;
      }
      const pr = batch[i];
      if (data.state === "MERGED") pr.state = "merged";
      else if (data.state === "CLOSED") pr.state = "closed";
      else pr.state = "open";
      pr.isDraft = data.isDraft;
      if (data.author && !pr.author) {
        pr.author = data.author.login;
        pr.avatarUrl = data.author.avatarUrl;
      }
    }
  } catch (e) {
    console.error("gh-sentinel: PR enrichment batch failed", e);
  }
}

async function enrichIssueBatch(batch: TriageItem[]): Promise<void> {
  try {
    const result = await ghGraphQL<IssueDetailResult>(
      buildIssueDetailQuery(
        batch.map((iss) => ({ repo: iss.repo, number: iss.number })),
      ),
    );
    if (!result?.data) {
      console.error("gh-sentinel: issue enrichment returned no data", result);
      return;
    }
    for (let i = 0; i < batch.length; i++) {
      const data = result.data[`issue${i}`]?.issue;
      if (!data) {
        batch[i].state = "closed";
        continue;
      }
      const issue = batch[i];
      if (data.state === "CLOSED") issue.state = "closed";
      else issue.state = "open";
      if (data.author && !issue.author) {
        issue.author = data.author.login;
        issue.avatarUrl = data.author.avatarUrl;
      }
    }
  } catch (e) {
    console.error("gh-sentinel: issue enrichment batch failed", e);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function enrichItems(items: TriageItem[]): Promise<void> {
  const prs = items.filter((item) => item.kind === "pr");
  const issues = items.filter((item) => item.kind === "issue");

  const prBatches = chunk(prs, ENRICH_BATCH_SIZE);
  const issueBatches = chunk(issues, ENRICH_BATCH_SIZE);

  await Promise.all([
    ...prBatches.map((batch) => enrichPrBatch(batch)),
    ...issueBatches.map((batch) => enrichIssueBatch(batch)),
  ]);
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
      ghGraphQL<SearchResult>(buildRepoScanQuery(batch, since)).catch(
        () => null,
      ),
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

  const since = new Date();
  since.setDate(since.getDate() - SCAN_LOOKBACK_DAYS);
  const sinceParam = since.toISOString();

  const [notifications, reviewRequested, assigned] = await Promise.all([
    ghRest<GitHubNotification[]>(
      `notifications?per_page=50&since=${sinceParam}`,
    ).catch(() => []),
    ghGraphQL<SearchResult>(SEARCH_REVIEW_REQUESTED).catch(() => null),
    ghGraphQL<SearchResult>(SEARCH_ASSIGNED).catch(() => null),
  ]);

  const notifItems = notifications
    .map(mapNotification)
    .filter((item): item is TriageItem => item !== null);

  const reviewItems =
    reviewRequested?.data.search.nodes.map((n) => mapSearchNode(n, "review")) ??
    [];
  const assignedItems =
    assigned?.data.search.nodes.map((n) => mapSearchNode(n, "assigned")) ?? [];

  const pinnedRepos = await getPinnedRepos();
  const scanSet = new Set<string>([
    ...watchedRepos,
    ...pinnedRepos.map((r) => r.toLowerCase()),
  ]);
  const scanned = (await scanWatchedRepos([...scanSet])).filter(
    (item) => !item.isDraft,
  );

  let merged = mergeItems([notifItems, reviewItems, assignedItems, scanned]);

  if (hasFilter) {
    merged = merged.filter((item) => watchedRepos.has(item.repo.toLowerCase()));
  }

  await enrichItems(merged);

  const dismissedKeys = await getDismissedIds();
  merged = merged.filter(
    (item) => item.state === "open" && !dismissedKeys.has(dismissKey(item)),
  );
  const scored = scoreAndSort(merged);

  return {
    items: scored,
    fetchedAt: Date.now(),
  };
}
