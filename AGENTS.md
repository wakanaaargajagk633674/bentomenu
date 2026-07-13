# Project instructions

## Git workflow (absolute rule)

- After creating or modifying project files, run the relevant checks.
- When the checks succeed, automatically commit all changes made for the task and push them to the current remote branch.
- Do not wait for the user to separately request a commit or push.
- Use a concise commit message that describes the completed change.
- If verification, commit, or push fails, report the failure clearly instead of claiming completion.
- Before committing, append a concise entry to `report/work-log.md` containing the date, requested outcome, work performed, files changed, sources added, verification results, and planned commit message.
- After committing and pushing, update that entry with the commit SHA and push result. If this creates a second documentation-only commit, commit and push it as well.
- Never delete or rewrite earlier work-log entries except to correct a factual error; append new entries in chronological order.

## Research reporting (absolute rule)

- Store human-readable HTML research reports under `report/`.
- For web research, record every material source with its title, publisher, URL, access date, source type, key evidence, how it influenced the project, confidence, and limitations.
- Keep detailed source reports separate from the concise procedural references used by skills.

## Culinary planning (absolute rule)

- For every bento plan, izakaya menu, recipe, plating, color, or culinary concept task, use `.agents/skills/culinary-menu-foundation/SKILL.md` as the mandatory foundation.
- Read the two mandatory references named by that skill and every cuisine-specific reference relevant to the task before proposing or implementing menu content.
- Do not produce generic lists of dishes. Apply the skill's concept, flavor, aroma, texture, temperature, color, cultural-integrity, service-quality, feasibility, and safety checks.
