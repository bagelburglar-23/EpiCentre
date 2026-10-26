"use server";

import { revalidatePath } from "next/cache";
import { addEvent, deleteEvent, markSyncedToGoogle } from "@/lib/events";
import { isGoogleCalendarConnected, pushEventToGoogle } from "@/lib/google-calendar";

export async function addEventAction(
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean,
  isTest: boolean
) {
  const result = addEvent(title, description, start, end, allDay, isTest);
  // Push to Google best-effort: a failure here (not connected, API error,
  // token expired) must not break saving the event locally - the row
  // already exists, just without gcal_event_id set.
  if (result && !result.isTest && isGoogleCalendarConnected()) {
    try {
      const gcalEventId = await pushEventToGoogle({
        title,
        description: description.trim() || null,
        start,
        end: end || start,
        allDay,
      });
      markSyncedToGoogle(result.id, gcalEventId);
    } catch (e) {
      console.error("Failed to push event to Google Calendar:", e);
    }
  }
  revalidatePath("/");
}

export async function deleteEventAction(id: number) {
  deleteEvent(id);
  revalidatePath("/");
}
