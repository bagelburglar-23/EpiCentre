import { connection } from "next/server";
import { listTodos } from "@/lib/todos";
import { listEventsInRange, listCachedGoogleEvents } from "@/lib/events";
import { isProduction } from "@/lib/db";
import { isGoogleCalendarConnected } from "@/lib/google-calendar";
import Shell from "@/components/Shell";
import TodoPanel from "@/components/TodoPanel";
import CalPlusPanel from "@/components/CalPlusPanel";

export default async function Home() {
  // new Date() is flagged as an "unstable value" during prerendering on its
  // own (same Cache Components rule as the better-sqlite3 calls elsewhere -
  // see lib/db.ts) - connection() has to come before it specifically, not
  // just before the DB calls further down.
  await connection();
  const isPreview = !isProduction();

  // Wide but bounded window (1 year back, 1 year forward) - Cal+'s month
  // view filters/paginates client-side within this (see CalPlusPanel),
  // which is fine at personal-calendar data volumes and avoids a server
  // round-trip on every month click. Revisit if this ever needs to go
  // back/forward further than a year.
  const now = new Date();
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)).toISOString();
  const rangeEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 11, 31)).toISOString();

  const [todos, events, googleEvents] = await Promise.all([
    listTodos(),
    listEventsInRange(rangeStart, rangeEnd),
    listCachedGoogleEvents(rangeStart, rangeEnd),
  ]);
  const googleConnected = isGoogleCalendarConnected();

  return (
    <Shell
      items={[
        {
          id: "todo",
          label: "To-Do",
          content: <TodoPanel initialTodos={todos} isPreview={isPreview} />,
        },
        {
          id: "calplus",
          label: "Cal+",
          content: (
            <CalPlusPanel
              initialEvents={events}
              googleEvents={googleEvents}
              googleConnected={googleConnected}
              isPreview={isPreview}
            />
          ),
        },
      ]}
    />
  );
}
