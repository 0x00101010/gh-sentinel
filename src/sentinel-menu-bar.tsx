import { Color, environment, Icon, Image, LaunchType, MenuBarExtra, open, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import type { TriageItem, RepoGroup } from "./lib/model/triage";
import { buildSnapshot } from "./lib/triage/buildSnapshot";
import { groupByRepo } from "./lib/triage/grouping";
import { getCachedSnapshot, setCachedSnapshot, clearCache } from "./lib/storage/cache";
import { notifyNewItems } from "./lib/notify/dedupe";
import { ghMarkAllRead } from "./lib/gh/ghClient";

import {
  getPinnedRepos,
  getHiddenRepos,
  pinRepo,
  unpinRepo,
  hideRepo,
  unhideRepo,
  dismissItem,
} from "./lib/storage/local";

function itemIcon(item: TriageItem): Image.ImageLike {
  if (item.kind === "issue") {
    if (item.state === "closed") return { source: "issue-closed.svg", tintColor: Color.Purple };
    return { source: "issue-open.svg", tintColor: Color.Green };
  }
  if (item.state === "closed") return { source: "pull-request-closed.svg", tintColor: Color.Red };
  if (item.isDraft) return { source: "pull-request-draft.svg", tintColor: Color.SecondaryText };
  return { source: "pull-request-open.svg", tintColor: Color.Green };
}

function itemSubtitle(item: TriageItem): string {
  const parts: string[] = [];
  if (item.author) parts.push(item.author);
  parts.push(`#${item.number}`);
  return parts.join(" ");
}

export default function SentinelMenuBar() {
  const [visibleGroups, setVisibleGroups] = useState<RepoGroup[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<RepoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(new Set());

  async function regroup(items: TriageItem[]) {
    const [pinned, hidden] = await Promise.all([getPinnedRepos(), getHiddenRepos()]);
    const { visible, hidden: hiddenG } = groupByRepo(items, pinned, hidden);
    setVisibleGroups(visible);
    setHiddenGroups(hiddenG);
    setPinnedSet(new Set(pinned));
    const visibleCount = visible.reduce((sum, g) => sum + g.items.length, 0);
    setTotalCount(visibleCount);
  }

  useEffect(() => {
    const cached = getCachedSnapshot();
    if (cached) {
      regroup(cached.items);
    }

    (async () => {
      try {
        const snapshot = await buildSnapshot();
        setCachedSnapshot(snapshot);
        await regroup(snapshot.items);

        if (environment.launchType === LaunchType.Background) {
          await notifyNewItems(snapshot.items);
        }
      } catch (e) {
        console.error("gh-sentinel fetch error:", e);
        if (environment.launchType === LaunchType.UserInitiated) {
          showToast({ style: Toast.Style.Failure, title: "Fetch failed", message: String(e) });
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handlePin(repo: string) {
    if (pinnedSet.has(repo)) {
      await unpinRepo(repo);
    } else {
      await pinRepo(repo);
    }
    const cached = getCachedSnapshot();
    if (cached) await regroup(cached.items);
  }

  async function handleHide(repo: string) {
    await hideRepo(repo);
    const cached = getCachedSnapshot();
    if (cached) await regroup(cached.items);
  }

  async function handleUnhide(repo: string) {
    await unhideRepo(repo);
    const cached = getCachedSnapshot();
    if (cached) await regroup(cached.items);
  }

  async function handleDismiss(item: TriageItem) {
    await dismissItem(item.id);
    const cached = getCachedSnapshot();
    if (cached) {
      const filtered = cached.items.filter((i) => i.id !== item.id);
      setCachedSnapshot({ items: filtered, fetchedAt: cached.fetchedAt });
      await regroup(filtered);
    }
  }

  return (
    <MenuBarExtra
      icon={{ source: "github-mark.svg", tintColor: Color.PrimaryText }}
      title={totalCount > 0 ? String(totalCount) : undefined}
      tooltip="GitHub Sentinel"
      isLoading={isLoading}
    >
      {visibleGroups.map((group) => {
        const isPinned = pinnedSet.has(group.repo);
        const prs = group.items.filter((i) => i.kind === "pr");
        const issues = group.items.filter((i) => i.kind === "issue");

        const renderItems = (items: TriageItem[]) =>
          items.map((item) => (
            <MenuBarExtra.Item
              key={item.id}
              icon={itemIcon(item)}
              title={item.title}
              subtitle={itemSubtitle(item)}
              onAction={() => open(item.htmlUrl)}
              alternate={
                <MenuBarExtra.Item
                  icon={Icon.XMarkCircle}
                  title={`Dismiss #${item.number}`}
                  onAction={() => handleDismiss(item)}
                />
              }
            />
          ));

        const repoActions = (
          <MenuBarExtra.Section>
            <MenuBarExtra.Item
              title={isPinned ? "Unpin Repo" : "Pin Repo"}
              icon={Icon.Pin}
              onAction={() => handlePin(group.repo)}
            />
            <MenuBarExtra.Item
              title="Hide Repo"
              icon={Icon.EyeDisabled}
              onAction={() => handleHide(group.repo)}
            />
          </MenuBarExtra.Section>
        );

        if (isPinned) {
          const INLINE_LIMIT = 10;
          const topPrs = prs.slice(0, INLINE_LIMIT);
          const overflowPrs = prs.slice(INLINE_LIMIT);
          const issueLimit = Math.max(0, INLINE_LIMIT - topPrs.length);
          const topIssues = issues.slice(0, issueLimit);
          const overflowIssues = issues.slice(issueLimit);

          return [
            topPrs.length > 0 && (
              <MenuBarExtra.Section key={`${group.repo}:pr`} title={`📌 ${group.repo} — PRs`}>
                {renderItems(topPrs)}
              </MenuBarExtra.Section>
            ),
            topIssues.length > 0 && (
              <MenuBarExtra.Section key={`${group.repo}:issue`} title={`📌 ${group.repo} — Issues`}>
                {renderItems(topIssues)}
              </MenuBarExtra.Section>
            ),
            (overflowPrs.length > 0 || overflowIssues.length > 0) && (
              <MenuBarExtra.Section key={`${group.repo}:more`}>
                <MenuBarExtra.Submenu title={`${overflowPrs.length + overflowIssues.length} more in ${group.repo}…`} icon={Icon.Ellipsis}>
                  {overflowPrs.length > 0 && (
                    <MenuBarExtra.Section title="Pull Requests">
                      {renderItems(overflowPrs)}
                    </MenuBarExtra.Section>
                  )}
                  {overflowIssues.length > 0 && (
                    <MenuBarExtra.Section title="Issues">
                      {renderItems(overflowIssues)}
                    </MenuBarExtra.Section>
                  )}
                </MenuBarExtra.Submenu>
              </MenuBarExtra.Section>
            ),
            <MenuBarExtra.Section key={`${group.repo}:actions`}>
              <MenuBarExtra.Item
                title="Unpin Repo"
                icon={Icon.Pin}
                onAction={() => handlePin(group.repo)}
              />
              <MenuBarExtra.Item
                title="Hide Repo"
                icon={Icon.EyeDisabled}
                onAction={() => handleHide(group.repo)}
              />
            </MenuBarExtra.Section>,
          ];
        }

        return (
          <MenuBarExtra.Submenu key={group.repo} title={`${group.repo} (${group.items.length})`}>
            {prs.length > 0 && (
              <MenuBarExtra.Section title="Pull Requests">
                {renderItems(prs)}
              </MenuBarExtra.Section>
            )}
            {issues.length > 0 && (
              <MenuBarExtra.Section title="Issues">
                {renderItems(issues)}
              </MenuBarExtra.Section>
            )}
            {repoActions}
          </MenuBarExtra.Submenu>
        );
      })}
      {hiddenGroups.length > 0 && (
        <MenuBarExtra.Section title="Hidden">
          {hiddenGroups.map((group) => (
            <MenuBarExtra.Submenu key={group.repo} title={`${group.repo} (${group.items.length})`} icon={Icon.EyeDisabled}>
              {group.items.map((item) => (
                <MenuBarExtra.Item
                  key={item.id}
                  icon={itemIcon(item)}
                  title={item.title}
                  subtitle={itemSubtitle(item)}
                  onAction={() => open(item.htmlUrl)}
                  alternate={
                    <MenuBarExtra.Item
                      icon={Icon.XMarkCircle}
                      title={`Dismiss #${item.number}`}
                      onAction={() => handleDismiss(item)}
                    />
                  }
                />
              ))}
              <MenuBarExtra.Item
                title="Unhide Repo"
                icon={Icon.Eye}
                onAction={() => handleUnhide(group.repo)}
              />
            </MenuBarExtra.Submenu>
          ))}
        </MenuBarExtra.Section>
      )}
      {(totalCount > 0 || hiddenGroups.length > 0) && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item
            title="Mark All as Read"
            icon={Icon.CheckCircle}
            onAction={async () => {
              try {
                await ghMarkAllRead();
                setVisibleGroups([]);
                setHiddenGroups([]);
                setTotalCount(0);
              } catch {
                // ignore
              }
            }}
          />
          <MenuBarExtra.Item
            title="Clear Cache & Refresh"
            icon={Icon.Trash}
            onAction={() => {
              clearCache();
              setVisibleGroups([]);
              setHiddenGroups([]);
              setTotalCount(0);
            }}
          />
        </MenuBarExtra.Section>
      )}
    </MenuBarExtra>
  );
}
