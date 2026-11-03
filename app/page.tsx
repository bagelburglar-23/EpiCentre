import { connection } from "next/server";
import { listTodos } from "@/lib/todos";
import { listLists } from "@/lib/lists";
import { listEventsInRange, listCachedGoogleEvents } from "@/lib/events";
import { isProduction } from "@/lib/db";
import { isGoogleCalendarConnected } from "@/lib/google-calendar";
import Shell from "@/components/Shell";
import ListsPanel from "@/components/ListsPanel";
import CalPlusPanel from "@/components/CalPlusPanel";
import EpiTraderPanel from "@/components/EpiTraderPanel";
import EpiPlannerPanel from "@/components/EpiPlannerPanel";
import SettingsPanel from "@/components/SettingsPanel";

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

  const [todos, lists, events, googleEvents] = await Promise.all([
    listTodos(),
    listLists(),
    listEventsInRange(rangeStart, rangeEnd),
    listCachedGoogleEvents(rangeStart, rangeEnd),
  ]);
  const googleConnected = isGoogleCalendarConnected();

  return (
    <Shell
      items={[
        {
          id: "lists",
          label: "EpiList",
          short: "Li",
          content: (
            <ListsPanel
              initialLists={lists}
              initialTodos={todos}
              isPreview={isPreview}
            />
          ),
        },
        {
          id: "calplus",
          label: "EpiCal",
          short: "Ca",
          content: (
            <CalPlusPanel
              initialEvents={events}
              googleEvents={googleEvents}
              googleConnected={googleConnected}
              isPreview={isPreview}
            />
          ),
        },
        {
          id: "epitrader",
          label: "EpiTrader",
          short: "Tr",
          content: <EpiTraderPanel />,
        },
        {
          id: "epiplanner",
          label: "EpiPlanner",
          short: "Pl",
          content: <EpiPlannerPanel />,
        },
        {
          id: "settings",
          label: "Settings",
          short: "☰",
          pinned: true,
          content: <SettingsPanel />,
        },
      ]}
    />
  );
}
