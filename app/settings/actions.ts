"use server";

import { changeAppPassword } from "@/lib/account";
import {
  addReminderSlot,
  updateReminderSlot,
  deleteReminderSlot,
} from "@/lib/reminders";
import { revalidatePath } from "next/cache";

export async function changePasswordAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) {
    return { error: "New password and confirmation don't match." };
  }
  const result = changeAppPassword(current, next);
  if (!result.ok) {
    return { error: result.error };
  }
  return { success: true };
}

// Reminder slots - thin "use server" adapters over lib/reminders (the core
// functions). revalidatePath("/") refreshes the single-page shell so the
// board re-renders from the DB after a mutation. The time string is
// validated (and silently ignored if malformed) inside lib/reminders.
export async function addReminderSlotAction(time: string): Promise<void> {
  addReminderSlot(time);
  revalidatePath("/");
}

export async function updateReminderSlotAction(
  id: number,
  time: string,
  enabled: boolean
): Promise<void> {
  updateReminderSlot(id, time, enabled);
  revalidatePath("/");
}

export async function deleteReminderSlotAction(id: number): Promise<void> {
  deleteReminderSlot(id);
  revalidatePath("/");
}
