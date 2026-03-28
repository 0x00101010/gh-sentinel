import type { TriageItem, TriageKind, TriageReason } from "../model/triage";
import type { GitHubNotification, SearchNode } from "./queries";

function notificationReasonToTriageReason(reason: string): TriageReason {
  switch (reason) {
    case "review_requested":
      return "review_requested";
    case "assign":
      return "assigned";
    case "mention":
    case "team_mention":
      return "mentioned";
    case "ci_activity":
      return "ci_failing";
    case "author":
      return "author";
    default:
      return "subscribed";
  }
}

function subjectTypeToKind(subjectType: string): TriageKind {
  return subjectType === "PullRequest" ? "pr" : "issue";
}

function extractNumber(apiUrl: string | null): number | null {
  if (!apiUrl) return null;
  const match = apiUrl.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function apiUrlToHtml(apiUrl: string | null, repo: string): string {
  if (!apiUrl) return `https://github.com/${repo}`;
  return apiUrl
    .replace("https://api.github.com/repos/", "https://github.com/")
    .replace("/pulls/", "/pull/");
}

export function mapNotification(n: GitHubNotification): TriageItem | null {
  const number = extractNumber(n.subject.url);
  if (!number) return null;

  const kind = subjectTypeToKind(n.subject.type);
  const reason = notificationReasonToTriageReason(n.reason);

  return {
    id: `notif:${n.repository.full_name}:${number}`,
    kind,
    title: n.subject.title,
    repo: n.repository.full_name,
    number,
    htmlUrl: apiUrlToHtml(n.subject.url, n.repository.full_name),
    updatedAt: n.updated_at,
    reasons: [reason],
    priority: 0,
    state: "open",
    author: "",
    avatarUrl: n.repository.owner.avatar_url,
    threadId: n.id,
  };
}

export function mapSearchNode(node: SearchNode, source: "review" | "assigned"): TriageItem {
  const kind: TriageKind = node.__typename === "Issue" ? "issue" : "pr";
  const reason: TriageReason = source === "review" ? "review_requested" : "assigned";

  let state: TriageItem["state"] = "open";
  if (node.state === "MERGED") state = "merged";
  else if (node.state === "CLOSED") state = "closed";

  return {
    id: `search:${node.repository.nameWithOwner}:${node.number}`,
    kind,
    title: node.title,
    repo: node.repository.nameWithOwner,
    number: node.number,
    htmlUrl: node.url,
    updatedAt: node.updatedAt,
    reasons: [reason],
    priority: 0,
    state,
    author: node.author?.login ?? "",
    avatarUrl: node.author?.avatarUrl ?? "",
  };
}
