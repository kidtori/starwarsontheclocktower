# Clocktower Studio

A local BOTC script builder with independent reusable theme libraries. Build or import the mechanics first, then cast the roles using a theme of your choice. New installations include the BOTC catalogue and start with no themes or characters.

## Run

The Windows portable release includes Node.js, Python and embedded Laya. Extract the archive and open Clocktower Studio.exe. Laya runs locally without a separate service or API key.

For source development with Node.js 22 or newer:

```sh
cd clocktower-studio
npm start
```

Open http://127.0.0.1:3210. Source checkouts can use corpus rules without the optional local model runtime. Prepare the runtime with scripts/prepare-laya.ps1 for embedded decisions.

## BOTC

**BOTC → Roles & expansions** combines your owned-set checkboxes with the searchable role catalogue, abilities and official jinxes. Disabled sets are excluded from searches, suggestions, generation and imports. The catalogue contains 181 records, including supplemental Travellers, Fabled and Loric.

Create a script using the left panel, or load a published script directly. Published scripts retain their exact composition and abilities. Dedicated required/excluded role fields control specific selections; the mechanical brief describes goals and synergies. Live progress follows Demons, Minions, Townsfolk and Outsiders.

Scripts are one-off sessions. **BOTC → Export Markdown** saves a portable draft, including roles, notes, preferences and identity choices. Import it next time. Undo history lasts only for the current session. An approved report is also available after review.

## Themes

**Themes → Manage themes** creates and selects named libraries. Add characters using the description, tags and narrative metaphor form, or import a JSON record/array. Each library lives in data/themes/<theme-id>/ and contains theme.json plus characters/*.json. IDs need only be unique within that theme. Editing records invalidates affected cached fits.

Changing themes clears the cast and theme preferences while retaining BOTC roles and abilities. No predefined lore, faction restrictions or character quotas are supplied. Theme character JSON supports id, name, summary, aliases, themes, personality, narrativeFunctions, castingProfile, castingBridges, relationships and attributed sources. See schemas/knowledge.schema.json#/$defs/character.

The desktop **Assess missing role fits** button uses embedded Laya to assess the selected theme against your owned BOTC roles. It runs in the background, saves each pairing and resumes unchanged work. Stop finishes the current pairing. Role clicks read saved fits immediately. **Find best fit for this cast** compares those fits against choices already made; assignments remain manual. Explanations describe supplied character evidence and creative metaphors; they are not model reasoning transcripts or calibrated confidence percentages.

Local settings and assessment caches are excluded from Git and release bundles. To move a theme, copy its folder to the same data/themes directory in another installation. The web builder supports temporary theme creation and manual casting, but embedded Laya runs only in the desktop app. Export your script before closing the browser; web libraries exist only for that session.

## Development

```sh
npm test
npm run build:web
npm run build:windows
```

Tests cover exact abilities, ownership, imports, theme isolation, grouped JSON edits, script history, bounded model decisions and the web adapter. Synthetic test identities are separate from the active catalogue. Theme material removed during the reset is retained only in an ignored local backup; it is not packaged or published.

BOTC is attributed to The Pandemonium Institute. This is an unofficial fan tool. See THIRD-PARTY-NOTICES.md for content and bundled runtime notices.
