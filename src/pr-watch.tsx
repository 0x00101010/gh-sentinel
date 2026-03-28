import { Cache, environment, getPreferenceValues, Icon, LaunchType, MenuBarExtra, open, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  fetchNotifications,
  filterByWatchedRepos,
  getSeenIds,
  groupNotifications,
  markAllAsRead,
  parseNotification,
  updateSeenIds,
} from "./lib/github";
import { notify } from "./lib/notifier";
import type { NotificationGroup, Preferences } from "./types";

const cache = new Cache();
const LAST_POLL_KEY = "last-poll-timestamp";

function shouldPoll(): boolean {
  const { pollInterval } = getPreferenceValues<Preferences>();
  const lastPoll = cache.get(LAST_POLL_KEY);
  if (!lastPoll) return true;
  const elapsed = Date.now() - parseInt(lastPoll, 10);
  return elapsed >= parseInt(pollInterval, 10) * 60_000;
}

function recordPoll(): void {
  cache.set(LAST_POLL_KEY, String(Date.now()));
}

const CATEGORY_ICONS: Record<string, Icon> = {
  review_requested: Icon.Eye,
  mentions: Icon.Bubble,
  replies: Icon.ArrowCounterClockwise,
};

export default function PrWatch() {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const isUserLaunch = environment.launchType === LaunchType.UserInitiated;

    if (!isUserLaunch && !shouldPoll()) {
      setIsLoading(false);
      return;
    }

    try {
      const raw = fetchNotifications();
      const parsed = raw.map(parseNotification);
      const filtered = filterByWatchedRepos(parsed);
      const grouped = groupNotifications(filtered);

      setGroups(grouped);
      setTotalCount(filtered.length);

      if (environment.launchType === LaunchType.Background) {
        const seenIds = getSeenIds();
        const unseen = filtered.filter((n) => !seenIds.has(n.id));
        for (const n of unseen) {
          notify({
            title: "GitHub",
            subtitle: n.repo,
            message: n.title,
            openUrl: n.htmlUrl,
            sound: "default",
            group: "gh-sentinel",
          });
        }
      }

      updateSeenIds(filtered.map((n) => n.id));
      recordPoll();
    } catch (e) {
      console.error("gh-sentinel fetch error:", e);
      showToast({ style: Toast.Style.Failure, title: "Fetch failed", message: String(e) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <MenuBarExtra
      icon={Icon.Bell}
      title={totalCount > 0 ? String(totalCount) : undefined}
      tooltip="GitHub Sentinel"
      isLoading={isLoading}
    >
      {groups.map((group) => (
        <MenuBarExtra.Section key={group.category} title={`${group.icon} ${group.label}`}>
          {group.notifications.map((n) => (
            <MenuBarExtra.Item
              key={n.id}
              icon={CATEGORY_ICONS[n.category] ?? Icon.Circle}
              title={n.title}
              subtitle={n.repo}
              onAction={() => open(n.htmlUrl)}
            />
          ))}
        </MenuBarExtra.Section>
      ))}
      {totalCount > 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title="Mark All as Read"
            icon={Icon.CheckCircle}
            onAction={() => {
              try {
                markAllAsRead();
                setGroups([]);
                setTotalCount(0);
              } catch {
                // ignore
              }
            }}
          />
        </MenuBarExtra.Section>
      )}
    </MenuBarExtra>
  );
}
