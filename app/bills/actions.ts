"use server";

import { revalidatePath } from "next/cache";
import { createBill, saveBill, deleteBill } from "@/lib/bills";

export async function createBillAction(name: string, isTest: boolean) {
  createBill(name, isTest);
  revalidatePath("/");
}

export async function saveBillAction(id: number, name: string, data: string) {
  saveBill(id, name, data);
  revalidatePath("/");
}

export async function deleteBillAction(id: number) {
  deleteBill(id);
  revalidatePath("/");
}
