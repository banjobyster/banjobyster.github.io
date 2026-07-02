# Templates

## `portfolio/` — self-describing project repos

Copy the [`portfolio/`](./portfolio) folder into any of your project repos to let
that repo describe its own portfolio card (data + screenshot live in the repo,
not here). The portfolio site reads it live from `raw.githubusercontent.com`, so:

- **No API token** is needed — raw files are public and not rate limited.
- The repo name must be added to the `FEATURED` list in
  [`src/data/projects.js`](../src/data/projects.js) with a `repo` field. Until a
  repo has a `portfolio/` folder, the local values in that file are used instead,
  so nothing breaks during migration.

Fields in `project.json` (all optional except `title`): `title`, `description`
(supports `**highlight**`), `demo`, `cover`, `accent`, `tags`.
