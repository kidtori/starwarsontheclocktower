# BOTC source snapshots

The `2026-10-02` directory contains downloaded public data snapshots, retained for provenance, verification and reproducible offline imports. The running application does not fetch any of these sources.

- `tracker-payload.json`: the character data embedded in https://botc-tracker.com/characters/ — 156 named characters.
- `official-roles.json`: https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/data/roles.json — 181 released records across seven types.
- `official-jinxes.json`: https://release.botc.app/resources/data/jinxes.json — 131 directed jinx rules.

The official resources page documents these public toolmaker feeds: https://release.botc.app/resources/. Blood on the Clocktower and its characters are © Steven Medway / The Pandemonium Institute. This local application is an unofficial community tool. Official assets are offered under the Community Created Content Policy: https://bloodontheclocktower.com/pages/community-created-content-policy. No character artwork is downloaded or used by this app.

Original ability strings, names, teams, setup flags and night instructions come from the official feed. Tracker coverage is cross-checked by name. Nine textual differences are recorded in `data/botc-catalogue.json`; official wording wins. The 25 records absent from Tracker are the Fabled and Loric characters.

`data/design/botc-annotations.json` contains editable draft design judgements. These purposes, complexity estimates, numeric mechanics, synergies and cautions are explicitly separate from official game rules. They are not official ratings and are not a substitute for playtesting. Official jinx texts are stored verbatim on both participating characters, with original source ownership retained.

All 181 normalised records live in `data/botc/characters/`. The generator and retheme cast operate on the 138 standard-team roles. The 43 Traveller/Fabled/Loric records are searchable references. Importing a supplemental entry into a four-team script prompts explicit handling instead of silently losing it.

To reproduce this import after editing annotations:

```powershell
node scripts/import-botc.js
```

This explicit command overwrites generated character records from these fixed snapshots and annotations. It backs up the current characters directory first under `backups/`. It does not alter any project or Star Wars record. Review the backup before deleting it. To update the sources in the future, save a fresh dated snapshot and update the importer paths/date deliberately; this version does not silently follow live changes.
