import { dismissKey, type TriageItem } from "../model/triage";
import { getSeenIds, addSeenIds } from "../storage/cache";
import { getPinnedRepos } from "../storage/local";
import { notify } from "./notifier";

export async function notifyNewItems(items: TriageItem[]): Promise<void> {
  const seenIds = getSeenIds();
  const pinnedRepos = await getPinnedRepos();
  const pinnedSet = new Set(pinnedRepos.map((r) => r.toLowerCase()));

  const unseen = items.filter((item) => {
    const key = dismissKey(item);
    if (seenIds.has(key)) return false;
    if (!pinnedSet.has(item.repo.toLowerCase())) return false;
    return true;
  });

  for (const item of unseen) {
    await notify({
      title: "GitHub",
      subtitle: item.repo,
      message: item.title,
      openUrl: item.htmlUrl,
      sound: "default",
      group: "gh-sentinel",
    });
  }

  addSeenIds(items.map((item) => dismissKey(item)));
}
