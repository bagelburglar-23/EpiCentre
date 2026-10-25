"use server";

import { revalidatePath } from "next/cache";
import { addEvent, deleteEvent } from "@/lib/events";

export async function addEventAction(
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean,
  isTest: boolean
) {
  addEvent(title, description, start, end, allDay, isTest);
  revalidatePath("/");
}

export async function deleteEventAction(id: number) {
  deleteEvent(id);
  revalidatePath("/");
}
