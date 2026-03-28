import { Color, environment, Icon, Image, LaunchType, MenuBarExtra, open, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import type { TriageItem, RepoGroup } from "./lib/model/triage";
import { buildSnapshot } from "./lib/triage/buildSnapshot";
import { groupByRepo } from "./lib/triage/grouping";
import { getCachedSnapshot, setCachedSnapshot } from "./lib/storage/cache";
import { notifyNewItems } from "./lib/notify/dedupe";
import { ghMarkAllRead } from "./lib/gh/ghClient";
import { openReview } from "./lib/review/launcher";
import {
  getPinnedRepos,
  getHiddenRepos,
  pinRepo,
  unpinRepo,
  hideRepo,
  unhideRepo,
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

  return (
    <MenuBarExtra
      icon={{ source: "github-mark.svg", tintColor: Color.PrimaryText }}
      title={totalCount > 0 ? String(totalCount) : undefined}
      tooltip="GitHub Sentinel"
      isLoading={isLoading}
    >
      {visibleGroups.map((group) => (
        <MenuBarExtra.Section key={group.repo} title={`${pinnedSet.has(group.repo) ? "📌 " : ""}${group.repo}`}>
          {group.items.map((item) => (
            <MenuBarExtra.Item
              key={item.id}
              icon={itemIcon(item)}
              title={item.title}
              subtitle={itemSubtitle(item)}
              onAction={() => open(item.htmlUrl)}
              alternate={
                item.kind === "pr" ? (
                  <MenuBarExtra.Item
                    icon={Icon.Terminal}
                    title={`Review #${item.number}`}
                    onAction={() => openReview(item.repo, item.number)}
                  />
                ) : undefined
              }
            />
          ))}
          <MenuBarExtra.Item
            title={pinnedSet.has(group.repo) ? "Unpin Repo" : "Pin Repo"}
            icon={Icon.Pin}
            onAction={() => handlePin(group.repo)}
          />
          <MenuBarExtra.Item
            title="Hide Repo"
            icon={Icon.EyeDisabled}
            onAction={() => handleHide(group.repo)}
          />
        </MenuBarExtra.Section>
      ))}
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
                    item.kind === "pr" ? (
                      <MenuBarExtra.Item
                        icon={Icon.Terminal}
                        title={`Review #${item.number}`}
                        onAction={() => openReview(item.repo, item.number)}
                      />
                    ) : undefined
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
        </MenuBarExtra.Section>
      )}
    </MenuBarExtra>
  );
}
