"use server";

import { revalidatePath } from "next/cache";
import {
  createList,
  renameList,
  deleteList,
  setListReminders,
} from "@/lib/lists";

export async function createListAction(name: string, isTest: boolean) {
  createList(name, isTest);
  revalidatePath("/");
}

export async function renameListAction(id: number, name: string) {
  renameList(id, name);
  revalidatePath("/");
}

export async function deleteListAction(id: number, deleteItems: boolean) {
  deleteList(id, deleteItems);
  revalidatePath("/");
}

export async function setListRemindersAction(id: number, enabled: boolean) {
  setListReminders(id, enabled);
  revalidatePath("/");
}
