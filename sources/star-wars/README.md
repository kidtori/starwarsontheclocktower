# Star Wars catalogue provenance

148 curated named people and droids, checked against individual biographies in the [official StarWars.com Databank](https://www.starwars.com/databank) on 2026-10-02. Coverage spans saga films, Rogue One, Solo, The Clone Wars, Rebels, The Bad Batch, Andor, The Mandalorian, The Book of Boba Fett, Obi-Wan Kenobi, Ahsoka, The Acolyte and Skeleton Crew. This is a broad starter catalogue, not every Star Wars or Legends identity.

`2026-10-02/*.json` caches the verified URL, page title, access date, source HTML SHA-256, appearances, affiliations, species where listed, and linked Databank entry slugs. These are metadata snapshots, not full biographies; no artwork or full source prose is copied. The checksum identifies the retrieved HTML, which is not retained here. Empty source categories mean not listed, not confirmed absence. Official source pages can change after the recorded access date.

`data/design/star-wars-seed.txt` contains concise factual paraphrases and explicitly editorial timeline groups, casting faction groups, narrative alignment, themes and 0–3 importance signals. Importance is a subjective initial draft, not measured popularity. Traits span story arcs, so a cast must specify/review the relevant portrayal. Source affiliations remain separately inspectable under `canonicalMetadata`; membership in a broad casting group is not a claim of uninterrupted allegiance.

`scripts/import-star-wars.js` supplies curated source-linked relationships. Relationships do not imply BOTC synergy. Aliases merge the same underlying person: Anakin/Vader, Sidious/Palpatine, Caleb/Kanan, Ben Solo/Kylo. Clones such as Boba/Jango and Osha/Mae are distinct individuals.

From the app directory, `node scripts/import-star-wars.js --fetch` fetches missing source snapshots with three concurrent requests and reports failed URLs. It does not overwrite cached sources. `node scripts/import-star-wars.js` validates the complete seed and source map, backs up existing main records, then rebuilds records and `data/star-wars-catalogue.json`. Offline rebuilding replaces generated annotations; preserve intentional custom edits in the seed/importer before rebuilding. Existing user project snapshots are untouched.

No Galactic Racer gameplay context is inferred from film racing or a character's Databank presence. The separate racing supplement now uses official game announcements; see sources/racing/README.md. Rerun the racing importer after rebuilding core Star Wars records to restore their racing profiles.
