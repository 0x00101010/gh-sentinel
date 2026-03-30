export type TriageKind = "pr" | "issue";

export type TriageReason =
  | "review_requested"
  | "assigned"
  | "mentioned"
  | "ci_failing"
  | "watched_repo_new"
  | "author"
  | "subscribed";

export const REASON_SCORES: Record<TriageReason, number> = {
  review_requested: 100,
  assigned: 70,
  mentioned: 50,
  ci_failing: 30,
  watched_repo_new: 10,
  author: 5,
  subscribed: 1,
};

export interface TriageItem {
  id: string;
  kind: TriageKind;
  title: string;
  repo: string;
  number: number;
  htmlUrl: string;
  updatedAt: string;
  reasons: TriageReason[];
  priority: number;
  state: "open" | "closed" | "merged";
  isDraft: boolean;
  author: string;
  avatarUrl: string;
  threadId?: string;
}

export interface TriageSnapshot {
  items: TriageItem[];
  fetchedAt: number;
}

export interface RepoGroup {
  repo: string;
  items: TriageItem[];
}

export function dismissKey(item: TriageItem): string {
  return `${item.repo}:${item.number}`;
}
