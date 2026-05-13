# Skill: Refinery Debugging & Ingestion

## Symptoms
- **Broken Accents**: Header detection fails due to encoding mismatch.
- **Wrong Header Row**: Title rows or blank lines at the top of CSV.
- **Unmapped Columns**: Cortex doesn't recognize a new client's column name.

## Protocol
1. **Check Encoding**: Try `utf-8-sig` for Excel CSVs, `cp1252` for standard Brazilian Windows CSVs.
2. **Normalize Test**: Run `_normalize_for_matching` on the problematic header string.
3. **Cortex Injection**: If a column is consistently missed, manually update `refinery/cortex_db.json`.
4. **Sniff Check**: Verify if the delimiter is actually `;` (standard) or `,` (international).

## Constraints
- Never manually edit normalized CSVs in `refinery/` temp folder; fix the ingestor logic instead.
- Preserve all `%` columns during mapping.
