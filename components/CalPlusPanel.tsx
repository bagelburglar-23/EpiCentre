"use client";

import { useMemo, useState, useTransition } from "react";
import { addEventAction, updateEventAction, deleteEventAction } from "@/app/calplus/actions";
import type { CalEvent, CachedGoogleEvent } from "@/lib/events";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ViewMode = "month" | "week" | "day";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

// Month shifts go via setUTCMonth, not +30 days - setUTCDate(1) first avoids
// e.g. Jan 31 -> Mar 3 (Feb only has 28/29 days) overflowing into the wrong
// month.
function shiftMonth(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return ymd(d);
}

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

function buildWeek(dateStr: string): Date[] {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    return x;
  });
}

// Unifies local (deletable) and Google-sourced (read-only - see
// lib/google-calendar.ts on why pulled events aren't editable from here)
// events into one shape for the grid/agenda to render without caring which
// is which, except for the delete handler's presence.
type DisplayEvent = {
  key: string;
  title: string;
  dateKey: string;
  start: string; // full ISO - naive wall-clock string, no timezone suffix (see timeLabel)
  allDay: boolean;
  isTest: boolean;
  source: "epic" | "google";
  calendarName?: string | null;
  onDelete?: () => void;
  onEdit?: () => void;
};

// event.start is stored as a plain "YYYY-MM-DDTHH:MM:SS" string with no
// timezone suffix (see EventModal below - it's built directly from
// <input type="date">/<input type="time"> values, no zone conversion
// anywhere in this app yet - see BACKLOG.md). Slicing it is deliberate,
// not a shortcut: `new Date(e.start)` would have the browser interpret the
// zone-less string as LOCAL time, which could silently shift the displayed
// hour depending on the viewer's device.
function timeLabel(e: DisplayEvent): string {
  return e.allDay ? "All day" : e.start.slice(11, 16);
}

function EventModal({
  defaultDate,
  isPreview,
  editing,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  defaultDate: string;
  isPreview: boolean;
  editing: CalEvent | null;
  onClose: () => void;
  onCreate: (
    title: string,
    description: string,
    start: string,
    end: string,
    allDay: boolean,
    isTest: boolean
  ) => void;
  onUpdate: (
    id: number,
    title: string,
    description: string,
    start: string,
    end: string,
    allDay: boolean
  ) => void;
  onDelete: (id: number) => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [startDate, setStartDate] = useState(editing ? editing.start.slice(0, 10) : defaultDate);
  const [startTime, setStartTime] = useState(editing ? editing.start.slice(11, 16) : "09:00");
  const [endDate, setEndDate] = useState(editing ? editing.end.slice(0, 10) : defaultDate);
  const [endTime, setEndTime] = useState(editing ? editing.end.slice(11, 16) : "10:00");
  const [allDay, setAllDay] = useState(editing ? editing.allDay : true);
  const [addAsTest, setAddAsTest] = useState(false);

  function submit() {
    if (!title.trim() || !startDate) return;
    const start = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const end = allDay ? `${endDate}T00:00:00` : `${endDate}T${endTime}:00`;
    if (editing) {
      onUpdate(editing.id, title, description, start, end, allDay);
    } else {
      onCreate(title, description, start, end, allDay, addAsTest);
    }
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
          {editing ? "Edit event" : "New event"}
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
          {isPreview && !editing && (
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
        <div className="mt-4 flex items-center justify-end gap-2">
          {editing && (
            <button
              onClick={() => {
                onDelete(editing.id);
                onClose();
              }}
              className="mr-auto rounded px-3 py-1.5 font-mono text-xs text-accent-bright hover:bg-accent-dim"
            >
              Delete
            </button>
          )}
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
            {editing ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared by month/week grids. Clicking anywhere on the cell (except an
// EpiC event chip, which opens it for editing instead - stopPropagation)
// drills into Day view for that date, same as clicking a date number in
// Google Calendar.
function GridDayCell({
  date,
  dimmed,
  isToday,
  dayEvents,
  maxVisible,
  tall,
  onOpenDay,
}: {
  date: Date;
  dimmed: boolean;
  isToday: boolean;
  dayEvents: DisplayEvent[];
  maxVisible: number;
  tall: boolean;
  onOpenDay: () => void;
}) {
  return (
    <div
      onClick={onOpenDay}
      className={`${tall ? "min-h-40" : "min-h-16"} cursor-pointer bg-black px-1 py-1 hover:bg-accent-dim/40 ${
        dimmed ? "opacity-30" : ""
      }`}
    >
      <div
        className={`mb-0.5 font-mono ${
          isToday ? "inline-block rounded bg-accent px-1 text-black" : "text-foreground/50"
        }`}
      >
        {date.getUTCDate()}
      </div>
      {dayEvents.slice(0, maxVisible).map((e) => (
        <div
          key={e.key}
          onClick={(ev) => {
            if (!e.onEdit) return;
            ev.stopPropagation();
            e.onEdit();
          }}
          title={
            e.source === "google"
              ? `${e.title} (${e.calendarName ?? "Google Calendar"} - read only)`
              : `${e.title} - click to edit`
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
      {dayEvents.length > maxVisible && (
        <div className="text-foreground/40">+{dayEvents.length - maxVisible} more</div>
      )}
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
  const todayKey = ymd(new Date());
  const [focusDate, setFocusDate] = useState(todayKey);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState(initialEvents);
  const [modalState, setModalState] = useState<{ date: string; editing: CalEvent | null } | null>(
    null
  );
  const [, startTransition] = useTransition();

  function openCreate(date: string) {
    setModalState({ date, editing: null });
  }

  function openEdit(event: CalEvent) {
    setModalState({ date: event.start.slice(0, 10), editing: event });
  }

  const focus = new Date(`${focusDate}T00:00:00Z`);
  const monthGrid = useMemo(() => {
    const d = new Date(`${focusDate}T00:00:00Z`);
    return buildGrid(d.getUTCFullYear(), d.getUTCMonth());
  }, [focusDate]);
  const weekGrid = useMemo(() => buildWeek(focusDate), [focusDate]);

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
        start: e.start,
        allDay: e.allDay,
        isTest: e.isTest,
        source: "epic",
        onDelete: () => remove(e.id),
        onEdit: () => openEdit(e),
      });
    }
    for (const e of googleEvents) {
      push({
        key: `google-${e.gcalEventId}`,
        title: e.title,
        dateKey: e.start.slice(0, 10),
        start: e.start,
        allDay: e.allDay,
        isTest: false,
        source: "google",
        calendarName: e.calendarName,
      });
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, googleEvents]);

  function navigate(delta: number) {
    setFocusDate((d) => {
      if (viewMode === "month") return shiftMonth(d, delta);
      if (viewMode === "week") return shiftDate(d, delta * 7);
      return shiftDate(d, delta);
    });
  }

  function openDay(key: string) {
    setFocusDate(key);
    setViewMode("day");
  }

  function headerLabel(): string {
    if (viewMode === "day") {
      return focus.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    if (viewMode === "week") {
      const [start, end] = [weekGrid[0], weekGrid[6]];
      const startLabel = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      const endLabel = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      return `${startLabel} – ${endLabel}`;
    }
    return focus.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
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

  function update(
    id: number,
    title: string,
    description: string,
    start: string,
    end: string,
    allDay: boolean
  ) {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === id
          ? { ...ev, title: title.trim(), description: description.trim() || null, start, end, allDay }
          : ev
      )
    );
    startTransition(async () => {
      await updateEventAction(id, title, description, start, end, allDay);
    });
  }

  function remove(id: number) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      await deleteEventAction(id);
    });
  }

  const dayEvents = eventsByDay.get(focusDate) ?? [];

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-mono text-sm uppercase tracking-wide text-accent-bright">
          Cal+
        </h1>
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex overflow-hidden rounded border border-accent-dim">
            {(["month", "week", "day"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-2 py-1 capitalize ${
                  viewMode === m
                    ? "bg-accent text-black"
                    : "text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded px-2 py-1 text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-foreground">{headerLabel()}</span>
          <button
            onClick={() => navigate(1)}
            className="rounded px-2 py-1 text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
          >
            ›
          </button>
          <button
            onClick={() => setFocusDate(todayKey)}
            className="rounded px-2 py-1 text-foreground/60 hover:bg-accent-dim hover:text-accent-bright"
          >
            Today
          </button>
          <button
            onClick={() => openCreate(focusDate)}
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

      {viewMode === "month" && (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-accent-dim bg-accent-dim text-[10px]">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="bg-black px-1.5 py-1 text-center font-mono text-foreground/40"
            >
              {d}
            </div>
          ))}
          {monthGrid.map((date) => {
            const key = ymd(date);
            return (
              <GridDayCell
                key={key}
                date={date}
                dimmed={date.getUTCMonth() !== focus.getUTCMonth()}
                isToday={key === todayKey}
                dayEvents={eventsByDay.get(key) ?? []}
                maxVisible={3}
                tall={false}
                onOpenDay={() => openDay(key)}
              />
            );
          })}
        </div>
      )}

      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-accent-dim bg-accent-dim text-[10px]">
          {weekGrid.map((date) => (
            <div
              key={`h-${ymd(date)}`}
              className="bg-black px-1.5 py-1 text-center font-mono text-foreground/40"
            >
              {DAY_LABELS[date.getUTCDay()]} {date.getUTCDate()}
            </div>
          ))}
          {weekGrid.map((date) => {
            const key = ymd(date);
            return (
              <GridDayCell
                key={key}
                date={date}
                dimmed={false}
                isToday={key === todayKey}
                dayEvents={eventsByDay.get(key) ?? []}
                maxVisible={8}
                tall={true}
                onOpenDay={() => openDay(key)}
              />
            );
          })}
        </div>
      )}

      {viewMode === "day" && (
        <div className="flex-1 overflow-auto rounded border border-accent-dim">
          {dayEvents.length === 0 ? (
            <div className="p-4 text-center font-mono text-xs text-foreground/30">
              No events.
            </div>
          ) : (
            dayEvents.map((e) => (
              <div
                key={e.key}
                onClick={() => e.onEdit?.()}
                className={`flex items-center justify-between gap-2 border-b border-accent-dim/50 px-3 py-2 font-mono text-xs ${
                  e.onEdit ? "cursor-pointer hover:bg-accent-dim/20" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-14 shrink-0 text-foreground/40">{timeLabel(e)}</span>
                  <span
                    className={`truncate ${
                      e.source === "google" ? "text-foreground/70" : "text-accent-bright"
                    }`}
                    title={
                      e.source === "google" ? e.calendarName ?? "Google Calendar" : undefined
                    }
                  >
                    {e.source === "google" && "G "}
                    {e.title}
                    {e.isTest && " (test)"}
                  </span>
                </div>
                {e.onDelete && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      e.onDelete?.();
                    }}
                    aria-label={`Delete ${e.title}`}
                    className="shrink-0 rounded px-2 py-0.5 text-foreground/40 hover:bg-accent hover:text-black"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {modalState && (
        <EventModal
          defaultDate={modalState.date}
          isPreview={isPreview}
          editing={modalState.editing}
          onClose={() => setModalState(null)}
          onCreate={add}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </div>
  );
}
