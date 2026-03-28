import type { TriageItem } from "../model/triage";
import { getSeenIds, addSeenIds } from "../storage/cache";
import { getNotifyRepoSet } from "../storage/local";
import { notify } from "./notifier";

export async function notifyNewItems(items: TriageItem[]): Promise<void> {
  const seenIds = getSeenIds();
  const notifyRepos = await getNotifyRepoSet();
  const hasFilter = notifyRepos.size > 0;

  const unseen = items.filter((item) => {
    if (seenIds.has(item.id)) return false;
    if (hasFilter && !notifyRepos.has(item.repo.toLowerCase())) return false;
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

  addSeenIds(items.map((item) => item.id));
}
