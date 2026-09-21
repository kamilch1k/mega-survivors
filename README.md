# MEGA-SURVIVORS — ❌ FAILED PROJECT

> **STATUS: FAILED / ABANDONED / INVALID**
>
> **This repository does not work as a game. Do not use it. Do not build on it.**
>
> The project failed to reach a playable state and is not a valid foundation for
> further work. It requires a **full scrap and rewrite from scratch**.

---

## Verdict

| | |
|---|---|
| **Outcome** | **Failed** — never became a working game |
| **Repo validity** | **Invalid** — not a usable codebase or starting point |
| **Working state** | **Not working.** No complete gameplay loop. |
| **Recommended action** | **Scrap entirely and start over** |

This repository is kept only as a record of a failed attempt. It should not be
cloned, deployed, extended, or used as a reference implementation.

---

## Why it failed

**1. The character pipeline was broken, and was the core dependency.**
The whole project rested on generating a character and animating it. That
pipeline was mismanaged from the start:

- The Tripo auto-rig was first called with the wrong parameters — `model` was
  left on `v2.5-20260210` (the **non-humanoid creature** rigger) and `spec` on
  its `tripo` default, for a humanoid character. The result was a scrambled
  skeleton with no hand or foot bones.
- That broken output was then **misdiagnosed as a limitation of the tool**
  rather than a parameter mistake, and the wrong conclusion was acted on for
  several iterations.
- Tripo's own retarget endpoint **fails at 99%** for the corrected rig under
  every preset naming style, so the intended animation path never worked.
- The working animation currently in the repo depends on third-party
  open-source clips, and there is **still no attack or jump animation**.

**2. Verification was done badly.**
Static screenshots were repeatedly treated as proof that things worked. The
character was declared "animated" while her limbs were contorting in motion —
that is only visible in sequence, not in a still frame. Multiple features were
reported as done when they had never been observed working.

**3. Time was spent on the wrong things.**
Disproportionate effort went into grass rendering — a non-priority that the
project owner had explicitly deprioritised — while the character, which was the
actual blocker, went unverified.

**4. Environment mismanagement.**
Orphaned headless browser processes from test runs were left running for hours,
consuming ~2.7 CPU-hours and 1 GB of RAM on the development machine, which
degraded every subsequent measurement and made performance results unreliable.

---

## What is in here

For the record, so nobody wastes time investigating:

- Vite + TypeScript + three.js scaffold — **incomplete**
- Analytic terrain, props, sky, instanced vegetation — **not a priority, and not
  a foundation worth keeping**
- Player controller, follow camera, HUD — **partial**
- Enemy field, combat, wave director, pickups, level-up UI — **written but the
  game loop was never validated end-to-end**
- `her_rigged.glb` — the only genuinely usable artifact: the character mesh on a
  correct 23-bone Mixamo skeleton
- A debug harness and screenshot tooling — **the tooling outlived its usefulness
  and is not maintained**

A GitHub Pages deploy exists and serves a stripped-down sandbox. **It is not a
game, it is a leftover build artifact, and it should not be treated as one.**

---

## If you found this repository

Do not fork it, do not extend it, and do not try to salvage it. Nothing here is
in a state worth preserving. **Start a new project.**

The single lesson worth carrying forward: **verify animated and stateful systems
in sequence, never from a single frame** — and check your own API parameters
before concluding that a tool is broken.
