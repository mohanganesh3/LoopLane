---
name: fundemenatals-for-backend
description: Verbatim copy of LoopLane/TASKS.md backend fundamentals transcript. Use when asked about backend concepts, philosophies, caching, databases, networking, or to quote/extract sections from the course notes. Always pull only the needed excerpts from references/TASKS.md instead of loading the full file.
---

# Fundemenatals For Backend

## Overview

- Holds the full text from `LoopLane/TASKS.md` (backend fundamentals course transcript) under `references/TASKS.md`.
- Designed to answer or quote backend theory questions (network flow, caching, databases, rate limiting, security, etc.) using that transcript.
- Keep context lean: never load the whole reference file; slice by topic.

## How to use this skill

1) Locate relevant sections quickly:
   - `rg -n "keyword" references/TASKS.md | head` to find line ranges.
   - `sed -n 'START,ENDp' references/TASKS.md` to pull only the needed excerpt.
2) Summarize or quote short excerpts (stay within quoting limits); cite the line numbers you pulled.
3) If asked for “everything” on a topic, batch multiple small slices instead of one huge load to protect context.

## Reference

- `references/TASKS.md` — verbatim copy of the original `LoopLane/TASKS.md` content.
