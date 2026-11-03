"use server";

import { revalidatePath } from "next/cache";
import { createList, renameList, deleteList } from "@/lib/lists";

export async function createListAction(name: string, isTest: boolean) {
  createList(name, isTest);
  revalidatePath("/");
}

export async function renameListAction(id: number, name: string) {
  renameList(id, name);
  revalidatePath("/");
}

export async function deleteListAction(id: number) {
  deleteList(id);
  revalidatePath("/");
}
