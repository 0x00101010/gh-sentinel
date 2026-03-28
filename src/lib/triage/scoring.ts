import type { TriageItem } from "../model/triage";
import { REASON_SCORES } from "../model/triage";

export function scoreItem(item: TriageItem): number {
  let score = 0;
  for (const reason of item.reasons) {
    score += REASON_SCORES[reason] ?? 0;
  }
  return score;
}

export function scoreAndSort(items: TriageItem[]): TriageItem[] {
  return items
    .map((item) => ({ ...item, priority: scoreItem(item) }))
    .sort((a, b) => b.priority - a.priority);
}
