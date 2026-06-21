# Plan: Adjust Campaign Leveling

Modify the campaign leveling progression to align with the correct map level ranges defined in `assets/ro_maps_level.json`.

## Goals
1. Write and execute a python command/script to regenerate `js/campaign/ro_level_rmi.json` from `assets/ro_maps_level.json`.
   - The maps should be sorted by minimum level (`min_level`).
   - In each level range, maps must be sorted alphabetically.
   - Output must be a JSON array of map names.
2. Update the `ro_quest_db.json` file (specifically `regions` and `levels`) to match the newly generated map sequence.
3. Verify the generated list and quest ranges.

## Success Criteria
- `js/campaign/ro_level_rmi.json` contains all unique maps from `assets/ro_maps_level.json` sorted by min level, then alphabetically.
- `js/campaign/ro_quest_db.json` is updated so that levels match the new map order.
