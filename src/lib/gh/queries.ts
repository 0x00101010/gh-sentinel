export const SEARCH_REVIEW_REQUESTED = `
query {
  search(query: "is:pr is:open review-requested:@me", type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        state
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

export function buildPrStateQuery(prs: { repo: string; number: number }[]): string {
  const aliases = prs.map((pr, i) => {
    const [owner, name] = pr.repo.split("/");
    return `pr${i}: repository(owner:"${owner}", name:"${name}") { pullRequest(number:${pr.number}) { state } }`;
  });
  return `query { ${aliases.join(" ")} }`;
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

export interface PrStateResult {
  data: Record<string, { pullRequest: { state: string } | null } | null>;
}
