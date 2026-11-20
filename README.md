# Notyet

Stop your coding agent from saying "done" until a real browser proves it.

> Your agent says sorry after you catch the bug. Notyet catches it first.

Built for the KaneCLI Online Hackathon (12-26 Nov 2026).

**Status:** early scaffold. Nothing here works yet; this README will be rewritten as the build lands.

## The idea

When a coding agent tries to finish a task, Notyet runs [Kane CLI](https://github.com/LambdaTest/kane-cli) in a real browser. It checks what the user sees and what a screenshot misses (failed network requests, console errors). If a check fails, the stop is blocked and Kane's failure goes back to the agent. Every verdict is written to a hash-chained log.

## License

Apache-2.0 (to be added with the first code commit).
