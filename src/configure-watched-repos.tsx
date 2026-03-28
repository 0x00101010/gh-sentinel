import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { exec } from "./lib/exec";
import type { WatchedRepo } from "./lib/model/settings";
import { getWatchedRepos, setWatchedRepos } from "./lib/storage/local";

interface RepoOption {
  name: string;
}

async function fetchUserRepos(): Promise<RepoOption[]> {
  try {
    const raw = await exec(
      'gh api "user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member" --jq ".[].full_name"',
      { timeout: 15_000 },
    );
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((name) => ({ name }));
  } catch {
    return [];
  }
}

export default function ConfigureWatchedRepos() {
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notifyRepos, setNotifyRepos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [available, saved] = await Promise.all([fetchUserRepos(), getWatchedRepos()]);
      setRepos(available);
      setSelected(saved.map((r) => r.repo));
      setNotifyRepos(new Set(saved.filter((r) => r.notify).map((r) => r.repo)));
      setIsLoading(false);
    })();
  }, []);

  async function handleSubmit() {
    const watchedRepos: WatchedRepo[] = selected.map((repo) => ({
      repo,
      notify: notifyRepos.has(repo),
    }));
    await setWatchedRepos(watchedRepos);
    showToast({ style: Toast.Style.Success, title: "Saved", message: `Watching ${watchedRepos.length} repos` });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TagPicker
        id="watched"
        title="Watched Repos"
        value={selected}
        onChange={setSelected}
      >
        {repos.map((repo) => (
          <Form.TagPicker.Item key={repo.name} value={repo.name} title={repo.name} />
        ))}
      </Form.TagPicker>
      <Form.TagPicker
        id="notify"
        title="Notify (native alerts)"
        value={[...notifyRepos]}
        onChange={(values) => setNotifyRepos(new Set(values))}
      >
        {selected.map((repo) => (
          <Form.TagPicker.Item key={repo} value={repo} title={repo} />
        ))}
      </Form.TagPicker>
    </Form>
  );
}
