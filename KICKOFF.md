# Kickoff prompt

Paste into the first Claude Code session, with this folder open in VS Code.

`CLAUDE.md` loads automatically, so this only carries what the files can't:
where we got to, and what to do first.

**Do not run `/init`** — it would overwrite a hand-written `CLAUDE.md` that
deliberately contains what the codebase can't tell you.

---

```
Read CLAUDE.md, ARCHITECTURE.md, ROADMAP.md, and state/decisions.md before
writing anything.

Context you won't get from the files: EpiCentre started as a markdown state
store with two Python scripts. I've since decided to rebuild it as a
single-user PWA — one app for everything in my life outside work. The repo
you're looking at is the specification, not an implementation. Nothing is
scaffolded yet.

Background on me: I trade equity derivatives. Strong Python and scripting,
comfortable with data modelling and debugging. Zero TypeScript, React, or
web experience — this is my first web app. Explain web-specific concepts the
first time they come up and name the idiom so I can look it up. Don't explain
general programming.

The requirement driving the whole design: I need to see something, decide it
needs a feature, and ship that feature within a day. Not days of refactoring.
The module contract in ARCHITECTURE.md is how we get there. If you find
yourself wanting to break one of its four rules, stop and tell me — that's a
design problem, not a thing to work around.

We are in Phase A. Exit condition: the ledger works on my phone, installed to
the home screen, with my real dates in it. Nothing outside that scope.
Push back if I try to add things mid-phase; I will try.

Before writing code, do three things:

1. Confirm what you understand the module contract to be, in your own words.
2. Tell me anything in ARCHITECTURE.md you think is wrong or will cause
   problems. I would rather fix the design now than at module three.
3. Propose the Phase A build order, smallest shippable step first. I want to
   see something running early, not a finished scaffold at the end.

Then stop and wait. Don't start scaffolding until I've responded.
```

---

## After session one

Later sessions need no prompt — `CLAUDE.md` and `state/threads.md` carry the
context. Just open the folder and say what you're working on.
