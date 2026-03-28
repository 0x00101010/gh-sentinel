import { Action, ActionPanel, Icon, List, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  fetchNotifications,
  filterByWatchedRepos,
  filterOpenPRs,
  groupNotifications,
  parseNotification,
} from "./lib/github";
import { postReview, runReview } from "./lib/reviewer";
import type { NotificationGroup, ParsedNotification, ReviewResult } from "./types";

export default function ReviewPrs() {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<Record<string, ReviewResult>>({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await fetchNotifications();
        const parsed = raw.map(parseNotification);
        const watched = filterByWatchedRepos(parsed);
        const filtered = await filterOpenPRs(watched);
        const grouped = groupNotifications(filtered);
        setGroups(grouped);
      } catch {
        showToast({ style: Toast.Style.Failure, title: "Failed to fetch notifications" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleReview(n: ParsedNotification) {
    if (!n.prNumber) {
      showToast({ style: Toast.Style.Failure, title: "Not a PR", message: "Can only review pull requests" });
      return;
    }

    setReviews((prev) => ({ ...prev, [n.id]: { status: "reviewing" } }));
    showToast({ style: Toast.Style.Animated, title: "Reviewing...", message: `${n.repo}#${n.prNumber}` });

    const result = await runReview(n.repo, n.prNumber);
    setReviews((prev) => ({ ...prev, [n.id]: result }));

    if (result.status === "done") {
      showToast({ style: Toast.Style.Success, title: "Review complete" });
    } else {
      showToast({ style: Toast.Style.Failure, title: "Review failed", message: result.error });
    }
  }

  async function handlePostReview(n: ParsedNotification) {
    const review = reviews[n.id];
    if (!review?.body || !n.prNumber) return;

    try {
      await postReview(n.repo, n.prNumber, review.body);
      showToast({ style: Toast.Style.Success, title: "Review posted", message: `${n.repo}#${n.prNumber}` });
    } catch (e) {
      showToast({ style: Toast.Style.Failure, title: "Post failed", message: String(e) });
    }
  }

  function reviewStatusIcon(id: string): Icon {
    const review = reviews[id];
    if (!review) return Icon.Circle;
    switch (review.status) {
      case "reviewing":
        return Icon.Clock;
      case "done":
        return Icon.CheckCircle;
      case "error":
        return Icon.XMarkCircle;
      default:
        return Icon.Circle;
    }
  }

  function detailMarkdown(id: string): string {
    const review = reviews[id];
    if (!review) return "*No review yet. Press ⌘R to start.*";
    switch (review.status) {
      case "reviewing":
        return "⏳ *Reviewing...*";
      case "done":
        return review.body ?? "";
      case "error":
        return `❌ **Error**\n\n${review.error}`;
      default:
        return "";
    }
  }

  return (
    <List isLoading={isLoading} isShowingDetail searchBarPlaceholder="Filter notifications...">
      {groups.map((group) => (
        <List.Section key={group.category} title={`${group.icon} ${group.label}`}>
          {group.notifications.map((n) => (
            <List.Item
              key={n.id}
              icon={reviewStatusIcon(n.id)}
              title={n.title}
              subtitle={n.repo}
              accessories={[{ text: n.prNumber ? `#${n.prNumber}` : n.subjectType }]}
              detail={<List.Item.Detail markdown={detailMarkdown(n.id)} />}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser title="Open in Browser" url={n.htmlUrl} />
                  {n.prNumber && (
                    <Action
                      title="Review with LLM"
                      icon={Icon.Stars}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={() => handleReview(n)}
                    />
                  )}
                  {reviews[n.id]?.body && n.prNumber && (
                    <Action
                      title="Post Review to GitHub"
                      icon={Icon.Upload}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                      onAction={() => handlePostReview(n)}
                    />
                  )}
                  <Action.CopyToClipboard
                    title="Copy URL"
                    content={n.htmlUrl}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
