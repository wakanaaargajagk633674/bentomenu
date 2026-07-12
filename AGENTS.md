# Project instructions

## Git workflow (absolute rule)

- After creating or modifying project files, run the relevant checks.
- When the checks succeed, automatically commit all changes made for the task and push them to the current remote branch.
- Do not wait for the user to separately request a commit or push.
- Use a concise commit message that describes the completed change.
- If verification, commit, or push fails, report the failure clearly instead of claiming completion.

## Culinary planning (absolute rule)

- For every bento plan, izakaya menu, recipe, plating, color, or culinary concept task, use `.agents/skills/culinary-menu-foundation/SKILL.md` as the mandatory foundation.
- Read the two mandatory references named by that skill and every cuisine-specific reference relevant to the task before proposing or implementing menu content.
- Do not produce generic lists of dishes. Apply the skill's concept, flavor, aroma, texture, temperature, color, cultural-integrity, service-quality, feasibility, and safety checks.
