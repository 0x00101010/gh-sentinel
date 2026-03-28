import type { TriageItem, RepoGroup } from "../model/triage";

export function groupByRepo(
  items: TriageItem[],
  pinnedRepos: string[] = [],
  hiddenRepos: Set<string> = new Set(),
): { visible: RepoGroup[]; hidden: RepoGroup[] } {
  const byRepo = new Map<string, TriageItem[]>();
  for (const item of items) {
    const list = byRepo.get(item.repo);
    if (list) {
      list.push(item);
    } else {
      byRepo.set(item.repo, [item]);
    }
  }

  const visible: RepoGroup[] = [];
  const hidden: RepoGroup[] = [];

  const pinnedSet = new Set(pinnedRepos);
  const pinned: RepoGroup[] = [];
  const unpinned: RepoGroup[] = [];

  for (const [repo, repoItems] of byRepo) {
    const group = { repo, items: repoItems };
    if (hiddenRepos.has(repo)) {
      hidden.push(group);
    } else if (pinnedSet.has(repo)) {
      pinned.push(group);
    } else {
      unpinned.push(group);
    }
  }

  pinned.sort((a, b) => pinnedRepos.indexOf(a.repo) - pinnedRepos.indexOf(b.repo));
  visible.push(...pinned, ...unpinned);

  return { visible, hidden };
}
