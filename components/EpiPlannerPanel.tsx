// Placeholder shell for the trip / day planner. Plain server component for
// now (no interactivity). The list below is a proposal, not a commitment -
// it's here so the empty tab still tells you what it's meant to become.

export default function EpiPlannerPanel() {
  const ideas: [string, string][] = [
    ["Link stash", "Paste a URL; a server action fetches its title/favicon (no Claude) so saved places/articles read cleanly."],
    ["Itinerary board", "Day-by-day columns; drag link cards and notes into time order."],
    ["Time-blocking", "Lay a day out on an hour grid; rough-plan, then tighten."],
    ["Places list", "Name + link + a one-line note; optional map pin later."],
    ["Push a day to Cal+", "Turn a planned day into events (reuses the existing .ics/calendar plumbing)."],
    ["Templates", "Reusable skeletons, e.g. “weekend trip” or “day in a new city”."],
  ];
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 font-mono text-sm uppercase tracking-wide text-accent-bright">
        EpiPlanner
      </h1>
      <p className="mb-4 text-sm text-foreground/60">
        Empty shell — a neat place to stash links and play with itineraries.
      </p>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-accent-bright">
        Ideas on the table
      </div>
      <ul className="space-y-2">
        {ideas.map(([name, note]) => (
          <li
            key={name}
            className="rounded border border-accent-dim bg-black px-3 py-2"
          >
            <div className="text-sm text-foreground">{name}</div>
            <div className="text-xs text-foreground/55">{note}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
