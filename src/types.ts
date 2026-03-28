// GitHub Notification API response shape
export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: NotificationReason;
  updated_at: string;
  subject: {
    title: string;
    url: string | null;
    latest_comment_url: string | null;
    type: SubjectType;
  };
  repository: {
    full_name: string;
    html_url: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

export type NotificationReason =
  | "review_requested"
  | "mention"
  | "team_mention"
  | "assign"
  | "author"
  | "comment"
  | "ci_activity"
  | "invitation"
  | "manual"
  | "security_alert"
  | "state_change"
  | "subscribed";

export type SubjectType = "PullRequest" | "Issue" | "Release" | "Discussion" | "CheckSuite" | "Commit";

export type NotificationCategory = "review_requested" | "mentions" | "replies";

// Normalized notification for display
export interface ParsedNotification {
  id: string;
  title: string;
  repo: string;
  repoUrl: string;
  htmlUrl: string;
  category: NotificationCategory;
  reason: NotificationReason;
  subjectType: SubjectType;
  prNumber: number | null;
  updatedAt: string;
  ownerAvatar: string;
}

// Grouping structures for display
export interface NotificationGroup {
  category: NotificationCategory;
  label: string;
  icon: string;
  notifications: ParsedNotification[];
}

export interface GroupedByRepo {
  repo: string;
  repoUrl: string;
  notifications: ParsedNotification[];
}

// Review state
export interface ReviewResult {
  status: ReviewStatus;
  body?: string;
  error?: string;
}

export type ReviewStatus = "pending" | "reviewing" | "done" | "error";

// Preferences from package.json
export interface Preferences {
  repos: string;
  pollInterval: string;
  reviewCommand: "claude" | "opencode";
  reviewPrompt: string;
  terminalNotifierPath: string;
}
