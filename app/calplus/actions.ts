"use server";

import { revalidatePath } from "next/cache";
import {
  addEvent,
  deleteEvent,
  updateEvent,
  markSyncedToGoogle,
  updateCachedGoogleEvent,
  deleteCachedGoogleEvent,
} from "@/lib/events";
import {
  isGoogleCalendarConnected,
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/google-calendar";

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

export async function updateEventAction(
  id: number,
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean
) {
  const result = updateEvent(id, title, description, start, end, allDay);
  // Propagate the edit to Google for EpiC-origin events (best-effort, same
  // reasoning as the push on add: a Google failure must not lose the local
  // save). Test rows and Google-sourced events never touch the API.
  if (result.changed && result.gcalEventId && !result.isTest && isGoogleCalendarConnected()) {
    try {
      await updateGoogleEvent(result.gcalEventId, {
        title,
        description: description.trim() || null,
        start,
        end: end || start,
        allDay,
      });
    } catch (e) {
      console.error("Failed to update event on Google Calendar:", e);
    }
  }
  revalidatePath("/");
}

export async function deleteEventAction(id: number) {
  const result = deleteEvent(id);
  if (result.gcalEventId && !result.isTest && isGoogleCalendarConnected()) {
    try {
      await deleteGoogleEvent(result.gcalEventId);
    } catch (e) {
      console.error("Failed to delete event on Google Calendar:", e);
    }
  }
  revalidatePath("/");
}

// Editing a Google-SOURCED event (pulled into the read-only cache): PATCH the
// event on its own Google calendar, then mirror the edit into the cache so
// Cal+ reflects it immediately (the next sync overwrites the row anyway).
// These hit the real Google account even from UAT (shared token), by design.
export async function updateGoogleEventAction(
  gcalEventId: string,
  calendarId: string,
  title: string,
  description: string,
  start: string,
  end: string,
  allDay: boolean
) {
  if (!gcalEventId || !isGoogleCalendarConnected()) return;
  const fields = {
    title: title.trim(),
    description: description.trim() || null,
    start,
    end: end || start,
    allDay,
  };
  try {
    await updateGoogleEvent(gcalEventId, fields, calendarId || "primary");
    updateCachedGoogleEvent(gcalEventId, fields);
  } catch (e) {
    console.error("Failed to update Google-sourced event:", e);
  }
  revalidatePath("/");
}

export async function deleteGoogleEventAction(
  gcalEventId: string,
  calendarId: string
) {
  if (!gcalEventId || !isGoogleCalendarConnected()) return;
  try {
    await deleteGoogleEvent(gcalEventId, calendarId || "primary");
    deleteCachedGoogleEvent(gcalEventId);
  } catch (e) {
    console.error("Failed to delete Google-sourced event:", e);
  }
  revalidatePath("/");
}
