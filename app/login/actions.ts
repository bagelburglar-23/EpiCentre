"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { verifyAppPassword } from "@/lib/account";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!verifyAppPassword(password)) {
    return { error: "Wrong password." };
  }
  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}
