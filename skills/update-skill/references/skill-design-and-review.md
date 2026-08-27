# Skill design and review

Use the current [Agent Skills specification](https://agentskills.io/specification)
for the portable format. Use the available `skill-creator` skill for the host's
current authoring and validation workflow. Anthropic's
[Agent Skills engineering guide](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
is the design rationale for progressive disclosure.

## Design for selection and loading

- The frontmatter `name` matches the directory and uses lowercase letters,
  digits, and hyphens.
- The `description` says what the skill does and when it applies. Add an
  exclusion only when it prevents likely misrouting.
- `SKILL.md` contains the shared workflow and decision boundaries. References
  contain details needed only for a particular task.
- Link references directly from `SKILL.md` and keep them one level deep.
- Do not create a reference, script, asset, README, or metadata file without a
  concrete consumer.

## Write for capable agents

Use direct, compact instructions. Preserve the facts, constraints, and failure
modes an agent would not safely infer from the code or task alone. Prefer:

- a short invariant over a broad tutorial;
- a current source example over a copied API manual;
- a decision criterion over an exhaustive checklist;
- a named delegation boundary over overlapping skills;
- a precise warning over historical narrative.

Avoid promotional language, generic coding advice, speculative future
features, and requirements derived from one incidental failure. Examples
should clarify a fragile handoff or non-obvious API shape.

## Review evidence

Review every material claim against the strongest available evidence:

1. shipped implementation, types, and tests for VibeKit behavior;
2. canonical specifications and official release notes for protocols;
3. maintained official documentation;
4. runnable source examples from the relevant version or branch;
5. third-party guides only for the third-party integration they own.

Record intentional branch exceptions and upstream commit SHAs. Avoid hard-coded
statuses, limits, package versions, or command names unless the skill needs
them and the maintenance workflow re-verifies them.

## Review outcome

A good update leaves:

- one clear owner for each workflow;
- no contradiction between related skills or generated project guidance;
- no stale or unpublished API presented as current;
- attribution beside materially adapted content;
- a regenerated bundle and passing validation;
- no unrelated worktree changes.

Behavioral testing is useful when a skill is complex or has demonstrated
misrouting. Do not create eval files by default, and do not use prose matching
as a substitute for testing repository behavior.
