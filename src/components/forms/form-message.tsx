import { Notice } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.ok && state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}
