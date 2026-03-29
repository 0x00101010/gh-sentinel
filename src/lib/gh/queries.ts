export const SEARCH_REVIEW_REQUESTED = `
query {
  search(query: "is:pr is:open review-requested:@me", type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        state
        isDraft
        updatedAt
        author { login avatarUrl }
        repository { nameWithOwner }
      }
    }
  }
}
`;

export const SEARCH_ASSIGNED = `
query {
  search(query: "is:open assignee:@me", type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        state
        isDraft
        updatedAt
        author { login avatarUrl }
        repository { nameWithOwner }
        __typename
      }
      ... on Issue {
        number
        title
        url
        state
        updatedAt
        author { login avatarUrl }
        repository { nameWithOwner }
        __typename
      }
    }
  }
}
`;

export function buildPrDetailQuery(prs: { repo: string; number: number }[]): string {
  const aliases = prs.map((pr, i) => {
    const [owner, name] = pr.repo.split("/");
    return `pr${i}: repository(owner:"${owner}", name:"${name}") { pullRequest(number:${pr.number}) { state isDraft author { login avatarUrl } } }`;
  });
  return `query { ${aliases.join(" ")} }`;
}

export function buildIssueDetailQuery(issues: { repo: string; number: number }[]): string {
  const aliases = issues.map((issue, i) => {
    const [owner, name] = issue.repo.split("/");
    return `issue${i}: repository(owner:"${owner}", name:"${name}") { issue(number:${issue.number}) { state author { login avatarUrl } } }`;
  });
  return `query { ${aliases.join(" ")} }`;
}

export interface IssueDetailResult {
  data: Record<string, { issue: { state: string; author: { login: string; avatarUrl: string } | null } | null } | null>;
}

export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: {
    title: string;
    url: string | null;
    latest_comment_url: string | null;
    type: string;
  };
  repository: {
    full_name: string;
    html_url: string;
    owner: { login: string; avatar_url: string };
  };
}

export interface SearchNode {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft?: boolean;
  updatedAt: string;
  author: { login: string; avatarUrl: string } | null;
  repository: { nameWithOwner: string };
  __typename?: string;
}

export interface SearchResult {
  data: {
    search: {
      nodes: SearchNode[];
    };
  };
}

export interface PrDetailResult {
  data: Record<string, { pullRequest: { state: string; isDraft: boolean; author: { login: string; avatarUrl: string } | null } | null } | null>;
}
