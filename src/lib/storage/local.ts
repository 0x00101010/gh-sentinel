import { LocalStorage } from "@raycast/api";
import type { WatchedRepo } from "../model/settings";

const WATCHED_REPOS_KEY = "watched-repos";
const PINNED_REPOS_KEY = "pinned-repos";
const HIDDEN_REPOS_KEY = "hidden-repos";
const DISMISSED_IDS_KEY = "dismissed-ids";

export async function getWatchedRepos(): Promise<WatchedRepo[]> {
  const raw = await LocalStorage.getItem<string>(WATCHED_REPOS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as WatchedRepo[];
}

export async function setWatchedRepos(repos: WatchedRepo[]): Promise<void> {
  await LocalStorage.setItem(WATCHED_REPOS_KEY, JSON.stringify(repos));
}

export async function getWatchedRepoSet(): Promise<Set<string>> {
  const repos = await getWatchedRepos();
  return new Set(repos.map((r) => r.repo.toLowerCase()));
}

export async function getNotifyRepoSet(): Promise<Set<string>> {
  const repos = await getWatchedRepos();
  return new Set(repos.filter((r) => r.notify).map((r) => r.repo.toLowerCase()));
}

async function getStringList(key: string): Promise<string[]> {
  const raw = await LocalStorage.getItem<string>(key);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

async function setStringList(key: string, list: string[]): Promise<void> {
  await LocalStorage.setItem(key, JSON.stringify(list));
}

export async function getPinnedRepos(): Promise<string[]> {
  return getStringList(PINNED_REPOS_KEY);
}

export async function getHiddenRepos(): Promise<Set<string>> {
  const list = await getStringList(HIDDEN_REPOS_KEY);
  return new Set(list);
}

export async function pinRepo(repo: string): Promise<void> {
  const pinned = await getPinnedRepos();
  if (!pinned.includes(repo)) {
    pinned.push(repo);
    await setStringList(PINNED_REPOS_KEY, pinned);
  }
}

export async function unpinRepo(repo: string): Promise<void> {
  const pinned = await getPinnedRepos();
  await setStringList(PINNED_REPOS_KEY, pinned.filter((r) => r !== repo));
}

export async function hideRepo(repo: string): Promise<void> {
  const hidden = await getStringList(HIDDEN_REPOS_KEY);
  if (!hidden.includes(repo)) {
    hidden.push(repo);
    await setStringList(HIDDEN_REPOS_KEY, hidden);
  }
}

export async function unhideRepo(repo: string): Promise<void> {
  const hidden = await getStringList(HIDDEN_REPOS_KEY);
  await setStringList(HIDDEN_REPOS_KEY, hidden.filter((r) => r !== repo));
}

export async function getDismissedIds(): Promise<Set<string>> {
  const list = await getStringList(DISMISSED_IDS_KEY);
  return new Set(list);
}

export async function dismissItem(id: string): Promise<void> {
  const dismissed = await getStringList(DISMISSED_IDS_KEY);
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    await setStringList(DISMISSED_IDS_KEY, dismissed);
  }
}

export async function undismissItem(id: string): Promise<void> {
  const dismissed = await getStringList(DISMISSED_IDS_KEY);
  await setStringList(DISMISSED_IDS_KEY, dismissed.filter((d) => d !== id));
}
