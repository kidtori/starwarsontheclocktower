# Star Wars Clocktower Studio

A standalone local web application for designing and reviewing Star Wars skins over existing Blood on the Clocktower characters. The desktop package includes Node.js, Python, Laya 0.3.6 and the local Laya decision-model checkpoint. It runs offline without a separate Laya service or API key. Source checkout can also run with corpus rules alone.

The BOTC database now contains **181 released characters** from the 2 October 2026 source snapshots: 69 Townsfolk, 23 Outsiders, 27 Minions, 19 Demons, 18 Travellers, 14 Fabled and 11 Loric. The 138 standard-team roles are available for script design; the other 43 are searchable supplemental references that can be preserved on import. It includes exact official ability text and 131 official jinx rules. See `sources/botc/README.md` for provenance and `data/botc-catalogue.json` for coverage checks, wording differences and backup locations. Initial mechanical annotations are clearly marked editorial drafts.

## Launch

### One-off webpage

The GitHub Pages version runs entirely in your browser, without accounts or a server database. Projects exist only for the current page session. Use **Export Markdown** before closing the tab and **Import Markdown** next time. The file preserves roles, requirements, supplemental entries, notes, locks and identity choices. Export works during mechanical review or retheming; an approved report is also available. Desktop projects are not uploaded or synchronized to the website.

Build with `npm run build:web`, then preview with `node scripts/preview-web.js`. The Pages workflow deploys `dist/web` from `main`. No credentials, local settings, saved projects or runtime binaries are included in the website.

Character fits compare BOTC mechanic concepts against explicit character themes, personality, narrative-function and archetype tags, with lower weight for factual descriptions. Common words are removed from both mechanical and brief matches. Names, source titles, URLs, factions, alignment labels and importance metadata never count as overlap evidence. The explanation names the field behind each matched concept; this is editorial assistance, not a claim that a narrative role reproduces a BOTC rule.

Retheming defaults to 49 characters: 44 with the existing highest editorial recognisability rating plus all five documented Galactic Racer identities. Each has a fuller casting portrait, proposed narrative metaphor and explicit fit limits. Essential, required and already selected characters remain available; choose **Full catalogue** to use all 162 identities. Popularity is an editorial scope choice, not a measured popularity ranking. The scope is preserved in Markdown.

Desktop Laya ranks concrete proposed story adaptations rather than trying to invent themes or test canonical powers. The editable `data/design/casting-bridges.json` contains 75 proposals across 15 roles. Role-specific proposals receive shortlist priority; essential choices, owned sets, exclusions and already assigned identities still apply. Other pairings remain exploratory. Laya compares each pair in both option orders and averages the weights, reducing positional bias. It suggests five with explanations and limits; ties retain the corpus order. The strength of a supplied story proposal is separate from how distinctly Laya ranks it. Similar alternatives do not become unsupported themes. Confidence measures option separation, not the probability that a casting is correct, and this domain is not calibrated. Identity selection remains manual; fewer suggestions appear only when fewer eligible identities remain.

### Windows executable

Download the Windows ZIP from this repository's Releases page, extract the whole folder to a writable location, and double-click **Clocktower Studio.exe**. Node.js and the complete Laya inference runtime are bundled. The browser opens automatically; the tray icon can reopen the app or stop its server. Keep the executable with the rest of the extracted folder. Each launch starts a new session. Export Markdown to keep the current script. Older project files are left untouched but are not loaded.

To build locally on Windows with Node.js 24.7.0 and .NET Framework installed:

```powershell
pwsh -NoProfile -File scripts/prepare-laya.ps1
pwsh -NoProfile -File scripts/build-windows.ps1
```

This creates a launcher in the application directory and a portable ZIP under `dist/`. Projects, backups, personal collection settings and `config.local.json` are excluded from Git and distributable packages. GitHub Actions runs tests and builds an artifact on pushes; version tags also publish a downloadable release. See `THIRD-PARTY-NOTICES.md` for corpus attribution and runtime notices.

### Run from source

Double-click `start-studio.cmd`, or run:

```powershell
cd path\to\clocktower-studio
npm start
```

Open http://127.0.0.1:3210. Leave the terminal running; Ctrl+C stops the server. The service binds only to loopback. All data and projects stay under this directory. Copy the directory to back it up. Use `PORT` to change the port when starting manually.

## First walkthrough

Work proceeds Demon → Minions → Townsfolk → Outsiders. Desktop generation shows selected roles as they finish; casting shows completed comparisons, the current provisional ranking and finished explanations while Laya is still working. Final results replace the preview when the operation completes. These are decision outcomes, not an internal reasoning transcript, and identities remain manually selected. Published and imported role lists retain their original composition and abilities.

1. Use **Fresh script** and the left-side setup to design a new script. Set composition, complexity, and mechanical goals such as poisoning, recurring information, protection or execution interactions.
2. Review abilities, source sets, synergies, tensions and applicable official jinx rules. Compare replacements or regenerate mechanics while keeping selected roles locked.
3. Alternatively, select Trouble Brewing, Bad Moon Rising or Sects & Violets under **Start with** to load it immediately, or use **Script → Import Markdown** to reopen an exported script. Existing scripts skip the mechanical brief, tone and role setup. Saved preferences are preserved. Imported roles and abilities cannot be replaced or regenerated. Travellers, Fabled and Loric entries are preserved separately with their abilities and source sets.
4. Click **Confirm mechanics & retheme**. This freezes the mechanical foundation and opens candidate classification for each role. No identity is assigned automatically.
5. In **Constraints**, select any number of essential Star Wars or Galactic Racer identities. Compatible priority candidates appear first. Inspect personality, narrative function and mechanical metaphor, then select a character for each role. Refreshing fits preserves all choices and BOTC mechanics.
6. Resolve review notes, inspect both analyses, and explicitly **Approve** before exporting Markdown. Hard casting requirements are checked at approval.
7. Reopen saved projects with **Open project…**. Undo/Redo restore full snapshots. Earlier projects retain their chosen cast and open in the retheming stage with a fixed mechanical foundation.

Small test scripts demonstrate the pipeline; they are not automatically playable or playtested. The original four-role and four-identity fixture corpus is preserved under `tests/fixtures/data` for regression tests. The active catalogue uses original official BOTC abilities and 162 source-backed Star Wars identities, including five confirmed Galactic Racer characters. Existing saved projects preserve their old snapshots; an explicit edit or regeneration refreshes their analysis against current knowledge.

## Populate the knowledge base

Edit one UTF-8 JSON object per file, or a JSON array in a grouped file:

```text
data/
  design-criteria.json
  botc/characters/empath.json
  star-wars/characters/leia-organa.json
  galactic-racer/
    characters/your-character.json
    factions/
    vehicles/
    story/
    relationships/
    lore/
```

Use **Knowledge → Reload files from disk** after editing. The app reports file paths and field-level validation errors. Errors block new project work until corrected. Existing project snapshots remain on disk. Knowledge import accepts JSON objects or arrays with an explicit overwrite option; it validates all records before writing. TXT script files are role lists, not knowledge imports. YAML, Markdown and CSV knowledge conversion is not implemented in this vertical slice; convert them to the documented JSON representation first. Nothing is hidden inside a proprietary index.

See `schemas/knowledge.schema.json` and the sample records for the machine-readable schema and examples. Runtime validation in `lib/knowledge.js` applies the area-specific contract; the generic schema can be referenced through `#/$defs/botc`, `#/$defs/starWars` or `#/$defs/galacticRacer` in your editor. Additional metadata is preserved.

### BOTC records

Required: `id`, `name`, `team`, `ability`, `mechanics`. Allowed types: `townsfolk`, `outsider`, `minion`, `demon`, `traveller`, `fabled`, `loric`. The last three load into `botcReference` rather than script generation. IDs are lowercase slugs; `officialId` retains the source's compact identifier and is also an explicit TXT alias. Use the real character name and **original ability**, never a Star Wars rename or a new ability. Optional fields include `aliases`, `edition`, `complexity` (`low`, `medium`, `high`), `tags`, `designRole`, `explanation`, `sources`, `interactions`, `jinxes`, `requiresRoles`, and `generationEligible`.

`mechanics` is an editable dictionary of numeric 0–3 editorial signals. Zero means no annotated contribution; missing means unannotated, not a canonical guarantee. Fields can include startingInformation, recurringInformation, alignmentInformation, characterInformation, registration, misinformation, poisoning, drunkenness, confirmation, protection, nominationInteraction, votingInteraction, executionInteraction, deathInteraction, outsiderManipulation, setupManipulation, bluffability, evilUtility, demonSurvivability and playerAgency. Narrative notes and tags carry information that should not be reduced to numbers.

Interaction lists use BOTC record IDs: `synergisesWith`, `conflictsWith`, `dangerousCombinations`. Put cautions in `storytellerNotes`. Imported official `jinxes` contain `characterId`, verbatim `reason`, `sourceOwner`, and `source`. The analyser displays applicable rules whenever both characters are on the script. It also flags absent `requiresRoles` companions. Full rules simulation is not implemented, and the dated jinx snapshot is not automatically updated. Corpus annotations and model critique assist review; neither certifies balance. The supplied importer authenticates its records against the official snapshot; arbitrary manually added records remain the user's responsibility.

Amnesiac, Atheist and Wizard are present for reference and retheming but excluded from automatic generation, because their use requires bespoke adjudication or an unconventional no-evil script. The app never invents an Amnesiac ability or a Wizard wish. Other unusual setups receive visible review cautions. These restrictions and the draft mechanical profiles are editable in `data/design/botc-annotations.json`; reproduce a deliberate corpus rebuild with `node scripts/import-botc.js`, which backs up the current corpus before overwriting generated records.

For registration exceptions, add `informationDistortion: {"scope":"self", "affectsRoleIds":["fortune-teller"], "description":"..."}` or scope `others` with explicit affected roles. This distinguishes the Fortune Teller's personal red herring from registration that can corrupt other characters' information. Unannotated scope produces a warning rather than assuming universal distortion.

### Star Wars records

The active catalogue has **162 named people and droids** (148 core identities plus 14 racing additions) across films and television, with verified official StarWars.com Databank URLs, appearances and affiliation metadata, concise factual paraphrases, 42 relationship pairs, and editable casting profiles. Coverage includes the saga films, Rogue One, Solo, Clone Wars, Rebels, Bad Batch, Andor, Mandalorian, Book of Boba Fett, Obi-Wan Kenobi, Ahsoka, Acolyte and Skeleton Crew. It is a broad curated catalogue, not an exhaustive Star Wars/Legends encyclopedia. **Knowledge → Browse Star Wars characters** searches names, aliases and themes and filters faction groups, eras and alignment. Source affiliations are shown separately from editorial casting factions.

Alternate names for the same person share one identity (Anakin/Vader, Sidious/Palpatine, Ben Solo/Kylo, Caleb/Kanan), preventing duplicate casting. Required and excluded names both accept aliases. Traits can span different life stages, so review the chosen portrayal. Era groups, good/evil/mixed labels, themes and importance ratings are explicitly editorial drafts rather than official popularity or alignment ratings. Galactic Racer context comes from official game announcements; unannounced roster details and vehicle assignments remain unspecified.

Inspect `data/star-wars-catalogue.json` for the coverage report and `sources/star-wars/README.md` for provenance. Edit the seed in `data/design/star-wars-seed.txt`; `node scripts/import-star-wars.js` validates and rebuilds offline with a backup of the existing records. `--fetch` retrieves missing official source metadata and reports failures. Backups and saved project snapshots are retained.

Required: `id`, `name`. Use arrays of strings for `source`, `era`, `factions`, `alignment`, `archetypes`, `personality`, `strengths`, `weaknesses`, `behaviours`, `narrativeFunctions`, `themes`, `abilitiesOrTraits`, `reputation`, `socialImpact`, `storyImpact`, and `gameplayAssociations`. Recommended alignment tags are `good`, `evil`, `neutral`; they describe presentation tendencies, not new BOTC alignment rules. `aliases` supports exact shorthand such as Leia. Required-character names resolve exact names or explicit aliases; the app never fabricates an unknown character.

Optional `importance` has 0–3 signals: `overall`, `recognisability`, `storyImportance`, `galacticRacerImportance`, `thematicImportance`. Relationships are objects with `characterId`, `type`, optional `description`. These signals help allocate prominent identities to meaningful niches across the whole cast. They are not probabilities.

### Owned BOTC sets and priority characters

**My BOTC collection** saves your owned sets locally in `data/app-settings.json`. Choose Trouble Brewing, Bad Moon Rising, Sects & Violets, Experimental/Carousel, Fabled and Loric as appropriate. All sets are enabled initially. Unchecked sets are removed from browser data, TXT resolution and suggestions, retrieval, generation and replacement candidates. Reference characters follow their official edition. The source catalogue and backups remain on disk. Historical projects preserve their snapshots; restore a missing set before editing or regenerating a script that uses it.

In **New Project** or **Constraints**, the searchable **Essential / priority characters** picker supports all Star Wars identities, the confirmed Galactic Racer cast, classic podracers and film speeder pilots. Select any number, including more than the script capacity. Generation maximises the number of eligible priority identities included, then compares narrative fit; locks, Sith-only Demons and hard requirements take precedence. **Theme Analysis** shows included priorities and explains omissions. Required-character text remains a separate hard constraint and must fit the script. Priority selections are saved with the project and its revision history.

The hard minimum Racer count refers to the five confirmed Galactic Racer game characters; film podracers do not automatically count toward it. This requirement is checked before approval; your per-role selections remain under your control.

### Galactic Racer enrichment

The populated catalogue contains five officially announced game characters, twelve classic film podracers, three film speeder pilots and twelve vehicle/class records. **Knowledge** provides racing group filters and inspectable vehicle sources. See `sources/racing/README.md` and `data/racing-catalogue.json` for research scope. The confirmed game group is a pre-release source snapshot, not an exhaustive playable roster.

Use `examples/galactic-racer-context.json` as a structural example outside the active corpus. Replace its placeholder ID and facts with your provided material, then import it. `characterId` references **one existing main Star Wars record**. This adds context without creating another identity. Missing references produce a visible warning.

Fields support roleInGame, personality, motivations, rivalries, allies, gameplayIdentity, vehicle, racingStyle, strengths, weaknesses, storyImportance, playerPerception and narrativeNotes. Supplementary lore/faction/vehicle/story JSON under the other folders is indexed as contextual documents. Racer character context is joined into retrieved main character records. The app does not invent Galactic Racer characters or facts.

### Provenance

`sources` is an array of objects with `type` and optional `title`, `description`, `url`. Use `canonical` for source facts, `interpretation` for your reading of narrative/personality, and `design` for script metadata. `internal` and `reference` are also accepted. Source attribution is displayed and can be exported. This classification is user-curated, not automatically verified.

## Language-model provider

Offline mode supports deterministic, inspectable candidate ranking, mechanical critique, per-role casting suggestions and focused conversation commands. **Open-ended natural-language interpretation requires a configured language model.** It is not disguised as an AI chat when no model is configured.

Copy `config.example.json` to `config.local.json` and set a chat-completions-compatible endpoint and an installed model name. For a local server, the example endpoint is `http://127.0.0.1:11434/v1/chat/completions`. If your endpoint requires authentication, set the environment variable named by `apiKeyEnv`; keys are never placed in the browser or project files. Config is reread per call. A remote endpoint receives retrieved excerpts; the UI displays the destination when the page loads.

The provider interface lives in `lib/model.js`; it can be replaced without changing storage or mechanical invariants. It sends only the current task, compact composition, retrieved records, candidate pools and relevant interactions. It does not research the web. Mechanical proposals and cast proposals are bounded to candidate IDs and validated for team counts, uniqueness, locks and required identities before anything is saved. Ability text is always copied from the local BOTC record, never model output. Failed/invalid model calls leave the project untouched.

Generation runs only a BOTC mechanical selection pass, including an optional bounded model proposal. The retheming stage ranks per-role candidates from local narrative annotations. Original abilities remain unchanged and assignments require a user choice. `data/design-criteria.json` contains editable mechanical vocabulary, mechanic/metaphor vocabulary and warning thresholds. Legacy automatic assignment remains covered by regression tests for historical compatibility; new projects use the two-stage workflow.

No Laya integration is forced into this implementation: bounded provider proposals and a transparent local ranking engine are sufficient for this slice. A future Laya adapter can implement the same explicit candidate-selection contract.

## Review and persistence guarantees

Each project uses its UUID directory under `projects/`. `project.json` is the authoritative history and cursor; `request.json`, `script.json`, `mappings.json`, `analysis.json`, `history.json` are inspectable current views. `approved.json` retains the most recently approved snapshot even after later edits. Undo/redo restores complete snapshots. Editing after undo retains abandoned revisions in the authoritative file's `archive`; the UI shows their count. The UI supports undo/redo, not arbitrary branch checkout.

During mechanical design, BOTC role locks keep selected roles during regeneration. Imported scripts are always fixed. Confirmation freezes every role and ability; later identity locks protect individual selections. Refreshing character fits never changes mechanics or assigned identities. Mechanical replacements are available only before confirmation on newly designed scripts.

Must-include, avoid, Sith Demon and minimum Racer requirements block approval if unmet. Preferred eras/factions, scoundrel Outsiders and Racer emphasis are soft preferences. Low-fit mappings and balance warnings remain visible and can be explicitly approved by the reviewer; open review notes block approval. Approval is never an automatic side effect of generation.

## Verification

```powershell
npm test
```

Tests exercise name resolution, composition preservation, constraints, locks, global assignment, replacement consequences, state transitions, storage recovery, retrieval and Markdown options. There is no dependency installation. Standard Node modules provide the server, storage and test runner.

Excluded by design: PDF/image export, portraits, tokens, custom artwork, printable layouts, new BOTC abilities and homebrew generation.

## Embedded Laya

The Windows package loads its own model weights in a private Python child process, communicating over stdin/stdout. No Laya HTTP server, sibling project, cloud endpoint or key is needed. Model loading and inference disable Hugging Face network access. CPU inference works without a GPU; initial loading and large scripts take longer. The package is substantially larger because it contains the roughly 843 MB checkpoint plus PyTorch and Python.

Laya is a typed decision model rather than a text-generating chatbot. For mechanics it chooses among up to four eligible candidates per slot. Only the Required BOTC roles and Excluded BOTC roles fields enforce named-role constraints. Mentions in the mechanical brief guide selection without requiring or excluding a role. Locked roles, owned sets and exact team sizes remain constraints enforced by the app. The design trace records Laya probabilities and confidence. Explicitly requested bespoke roles such as Wizard remain subject to their Storyteller warnings. Imported scripts bypass generation entirely.

After confirming mechanics, select a role or use **Suggest 5 with Laya**. Review the five numbered alternatives, their explanations, limits and direct comparison evidence, then choose the final identity. Essential characters take priority when compatible. Laya never changes abilities or automatically replaces your assignment. New assignments or changed requirements invalidate rankings so characters already used elsewhere are not suggested. Mechanical review uses Laya to select a review focus and returns source-backed notes. Confidence is a shortlist decision signal, not a balance guarantee.

The GitHub Pages builder remains available with corpus rules, named-role requirements and TXT import/export. It does not execute Laya. Tests isolate deterministic corpus behavior with `STUDIO_LAYA_DISABLED=1`; verify the bundled model separately with `node scripts/smoke-laya.js`.

## One-page, one-off workspace

Each desktop or web launch starts a fresh script. Requirements and the new-script form stay on the left, the full ability script is in the centre, and selected-role information and suggested identities scroll on the right. The collection chooser uses aligned checkbox cards. Turn on Show connections and click a role to highlight official jinxes, curated synergies, tensions and specific shared mechanic signals. Generic agency and evil-utility tags do not create links. Draft requirements survive role selection. Laya compares eligible identity shortlists automatically when selecting a role during retheming.

Use **Export Markdown** at any stage, and **Import Markdown** next time. The readable file includes a machine-readable Clocktower import block that preserves requirements, exact abilities, supplemental roles, selected identities, notes and locks. Imported role lists remain fixed. Keep the block intact; mismatched abilities, missing roles and unowned sets produce an error. No past-project picker or project database is used; undo belongs only to the current app session. Older project files remain untouched on disk but are not loaded. The previous TXT format remains supported by the source parser. The approved-report export is an optional separate review document.

Input to the Python worker uses explicit UTF-8 and normalizes invalid Unicode before tokenization. Generation progress streams to the same viewer as roles are chosen.
