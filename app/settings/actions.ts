"use server";

import { changeAppPassword } from "@/lib/account";

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
