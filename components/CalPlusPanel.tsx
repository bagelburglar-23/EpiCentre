"use client";

import { useMemo, useState, useTransition } from "react";
import { addEventAction, deleteEventAction } from "@/app/calplus/actions";
import type { CalEvent, CachedGoogleEvent } from "@/lib/events";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Unifies local (deletable) and Google-sourced (read-only - see
// lib/google-calendar.ts on why pulled events aren't editable from here)
// events into one shape for the grid to render without caring which is
// which, except for the delete handler's presence.
type DisplayEvent = {
  key: string;
  title: string;
  dateKey: string;
  isTest: boolean;
  source: "epic" | "google";
  calendarName?: string | null;
  onDelete?: () => void;
};

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay(); // 0=Sun
  const gridStart = new Date(first);
  gridStart.setUTCDate(1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });
}

function EventModal({
  defaultDate,
  isPreview,
  onClose,
  onSubmit,
}: {
  defaultDate: string;
  isPreview: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    description: string,
    start: string,
    end: string,
    allDay: boolean,
    isTest: boolean
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(defaultDate);
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(true);
  const [addAsTest, setAddAsTest] = useState(false);

  function submit() {
    if (!title.trim() || !startDate) return;
    const start = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const end = allDay ? `${endDate}T00:00:00` : `${endDate}T${endTime}:00`;
    onSubmit(title, description, start, end, allDay, addAsTest);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded border border-accent-dim bg-black p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-accent-bright">
          New event
        </h2>
        <div className="flex flex-col gap-2.5">
          <input
            autoFocus
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="rounded border border-accent-dim bg-black px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-foreground/60">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            All day
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="flex-1 rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {!allDay && (
              <input
                type="time"
                className="rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="flex-1 rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {!allDay && (
              <input
                type="time"
                className="rounded border border-accent-dim bg-black px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            )}
          </div>
          {isPreview && (
            <label className="flex items-center gap-2 text-xs text-foreground/60">
              <input
                type="checkbox"
                checked={addAsTest}
                onChange={(e) => setAddAsTest(e.target.checked)}
              />
              Add as test (UAT only)
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 font-mono text-xs text-foreground/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-medium text-black hover:bg-accent-bright"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalPlusPanel({
  initialEvents,
  googleEvents,
  googleConnected,
  isPreview,
}: {
  initialEvents: CalEvent[];
  googleEvents: CachedGoogleEvent[];
  googleConnected: boolean;
  isPreview: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth());
  const [events, setEvents] = useState(initialEvents);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayKey = ymd(today);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DisplayEvent[]>();
    const push = (e: DisplayEvent) => {
      if (!map.has(e.dateKey)) map.set(e.dateKey, []);
      map.get(e.dateKey)!.push(e);
    };
    for (const e of events) {
      push({
        key: `epic-${e.id}`,
        title: e.title,
        dateKey: e.start.slice(0, 10),
        isTest: e.isTest,
        source: "epic",
        onDelete: () => remove(e.id),
      });
    }
    for (const e of googleEvents) {
      push({
        key: `google-${e.gcalEventId}`,
        title: e.title,
        dateKey: e.start.slice(0, 10),
        isTest: false,
        source: "google",
        calendarName: e.calendarName,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, googleEvents]);

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function add(
    title: string,
    description: string,
    start: string,
    end: string,
    allDay: boolean,
    isTest: boolean
  ) {
    const optimistic: CalEvent = {
      id: -Date.now(),
      title: title.trim(),
      description: description.trim() || null,
      start,
      end,
      allDay,
      isTest: isPreview && isTest,
    };
    setEvents((prev) => [...prev, optimistic]);
    startTransition(async () => {
      await addEventAction(title, description, start, end, allDay, isPreview && isTest);
    });
  }

  function remove(id: number) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteEventAction(id);
    });
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
          Cal+
        </h1>
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded px-2 py-1 text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
          >
            ‹
          </button>
          <span className="min-w-[8rem] text-center text-foreground">
            {new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded px-2 py-1 text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
          >
            ›
          </button>
          <button
            onClick={() => setModalDate(todayKey)}
            className="ml-2 rounded bg-accent px-2.5 py-1 font-medium text-black hover:bg-accent-bright"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="mb-2 font-mono text-[10px] text-foreground/40">
        {googleConnected ? (
          <>
            Google Calendar connected - new events here sync to it, events
            from every calendar on the account shown read-only (marked G).{" "}
            <a
              href="/api/auth/google/connect"
              className="text-accent hover:text-accent-bright"
            >
              Reconnect
            </a>{" "}
            if you connected before multi-calendar pull was added.
          </>
        ) : (
          <a href="/api/auth/google/connect" className="text-accent hover:text-accent-bright">
            Connect Google Calendar →
          </a>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-accent-dim bg-accent-dim text-[10px]">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="bg-black px-1.5 py-1 text-center font-mono text-foreground/40"
          >
            {d}
          </div>
        ))}
        {grid.map((date) => {
          const key = ymd(date);
          const inMonth = date.getUTCMonth() === viewMonth;
          const dayEvents = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              onClick={() => setModalDate(key)}
              className={`min-h-16 cursor-pointer bg-black px-1 py-1 hover:bg-accent-dim/40 ${
                inMonth ? "" : "opacity-30"
              }`}
            >
              <div
                className={`mb-0.5 font-mono ${
                  key === todayKey
                    ? "inline-block rounded bg-accent px-1 text-black"
                    : "text-foreground/50"
                }`}
              >
                {date.getUTCDate()}
              </div>
              {dayEvents.slice(0, 3).map((e) => (
                <div
                  key={e.key}
                  onClick={(ev) => {
                    if (!e.onDelete) return;
                    ev.stopPropagation();
                    e.onDelete();
                  }}
                  title={
                    e.source === "google"
                      ? `${e.title} (${e.calendarName ?? "Google Calendar"} - read only)`
                      : `${e.title} - click to delete`
                  }
                  className={`mb-0.5 truncate rounded px-1 ${
                    e.source === "google"
                      ? "bg-foreground/10 text-foreground/70"
                      : "bg-accent-dim text-accent-bright"
                  }`}
                >
                  {e.source === "google" && "G "}
                  {e.title}
                  {e.isTest && " (test)"}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-foreground/40">+{dayEvents.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {modalDate && (
        <EventModal
          defaultDate={modalDate}
          isPreview={isPreview}
          onClose={() => setModalDate(null)}
          onSubmit={add}
        />
      )}
    </div>
  );
}
