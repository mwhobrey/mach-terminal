import type { AiChatMessage } from "./aiChatState";
import type { AiChatTurn } from "./terminal";
import { AI_CONTEXT_OUTPUT_MAX_CHARS } from "./terminal";

/** Default total character budget for prompt + history + context (≈7k tokens). */
export const DEFAULT_AI_CONTEXT_BUDGET_CHARS = 28_000;

/** Max prior turns sent to the provider (user + assistant pairs). */
export const AI_HISTORY_MAX_TURNS = 20;

export function messagesToHistoryTurns(messages: readonly AiChatMessage[]): AiChatTurn[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/** Drop oldest turns until history fits the reserved slice of the total budget. */
export function trimHistoryToBudget(turns: readonly AiChatTurn[], maxChars: number): AiChatTurn[] {
  if (maxChars <= 0 || turns.length === 0) {
    return [];
  }
  const kept: AiChatTurn[] = [];
  let total = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const size = turn.content.length;
    if (kept.length > 0 && total + size > maxChars) {
      break;
    }
    kept.unshift(turn);
    total += size;
  }
  return kept;
}

export function reserveHistoryBudget(
  totalBudgetChars: number,
  promptChars: number,
  contextOverheadChars = 900,
): number {
  const reserved = promptChars + contextOverheadChars;
  return Math.max(0, totalBudgetChars - reserved);
}

export function buildHistoryForExecute(
  priorMessages: readonly AiChatMessage[],
  prompt: string,
  totalBudgetChars = DEFAULT_AI_CONTEXT_BUDGET_CHARS,
): AiChatTurn[] {
  const allTurns = messagesToHistoryTurns(priorMessages);
  const capped = allTurns.slice(-AI_HISTORY_MAX_TURNS * 2);
  const historyBudget = reserveHistoryBudget(totalBudgetChars, prompt.trim().length);
  return trimHistoryToBudget(capped, historyBudget);
}

/** Merge scrollback tail with attachment excerpt without exceeding per-request excerpt cap. */
export function mergeOutputExcerpts(
  scrollbackTail: string | undefined,
  attachmentBlock: string | undefined,
  maxChars = AI_CONTEXT_OUTPUT_MAX_CHARS,
): string | undefined {
  const parts = [attachmentBlock?.trim(), scrollbackTail?.trim()].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );
  if (parts.length === 0) {
    return undefined;
  }
  const combined = parts.join("\n\n---\n\n");
  if (combined.length <= maxChars) {
    return combined;
  }
  return combined.slice(combined.length - maxChars);
}
