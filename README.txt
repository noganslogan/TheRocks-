THE ROCKS. v0.2 — single-file browser prototype

To play on iPhone, use Safari on an HTTPS-hosted copy. Deploy the root directory as a static site on Cloudflare Pages; no build step or dependencies.

Controls: Left virtual stick / WASD to move; drag the view or arrow keys to look. Tap COLLECT near the rock mountain; UNLOAD at the truck across the yard; visit the tool shed in the right corner to purchase or equip tools. Desktop E or Space performs the context action; B opens the shop when near the shed. Local progress is saved when browser storage is available.

The mountain represents one billion rocks using a volumetric mound and thousands of colored low-poly surface meshes. Its volume scales with remaining rock count. Scooping and breaking release a bounded batch of gravel with gravity, bouncing and rolling; individual rock-to-rock collisions and persistent rigid bodies are not simulated. The held hand and tools are genuine 3D meshes. Large stones and boulders unlock with progress.

This build implements manual labor through the wheelbarrow. Industrial automation and endgame are not yet implemented. WebGL is preferred, with a lower-detail software canvas fallback. Logic and mocked rendering checks passed; actual visual appearance and performance on iOS Safari require device testing.
