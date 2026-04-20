 1. Campaign Generator CLI
  Located at campaign/generator.js. You can use it to generate custom levels from the
  command line:

   1 # Example usage:
   2 node campaign/generator.js \
   3   --name="Valley of Shadow" \
   4   --dice="11/21/31/41/51/61" \
   5   --enemies="13/22/51" \
   6   --terrain="forest:8,lake:4,mountain:3" \
   7   --limit=4 \
   8   --output="campaign/level1.json"

   * --dice: Format [type][count]. 11/21/31/41/51/61 gives you one of each class (The
     Legendary Six).
   * --enemies: Same format. 13 means 3 units of Type 1.
   * --terrain: Randomly distributes specified terrain types across the map.
   * --limit: Sets the deployment limit for the player.

  2. JSON Map Loading
  The game now supports loading these maps via the URL:
   * Append ?campaign_map=level1.json to the URL.
   * The system will automatically:
       * Set the map radius.
       * Load the specified P1 and P2 units.
       * Place the generated terrain.
       * Auto-deploy enemy units randomly in their deployment zone.
       * Set the Deployment Limit for the player.

  3. Integrated Workflow
   1. Generate: Use the CLI to create level1.json, level2.json, etc., in the campaign/
      folder.
   2. Play: Access the levels directly (e.g., index.html?campaign_map=level1.json).
   3. Persistence: The Fatigue system in CampaignManager will still track unit usage
      across these JSON-loaded sessions, ensuring "Scars" carry over if you play multiple
      maps in sequence.

  The CampaignManager and game.js have been updated to handle the asynchronous loading of
  these maps while maintaining all the fatigue and rune logic.