THE ROCKS. v0.1 — single-file browser prototype

To play on a computer, open index.html in a browser. On iPhone, use Safari on an HTTPS-hosted copy. The iOS Files preview may not run JavaScript.

Host by uploading index.html at the root of any static hosting service (e.g. Cloudflare Pages Direct Upload). No build step, libraries, servers or external assets are required.

Controls: Left virtual stick / WASD to move; drag the view or use arrow keys to look. Tap COLLECT near the pile, UNLOAD near the truck, UPGRADES to spend rock credits. Desktop E or Space performs the context action; B opens the shop. Local progress is saved when browser storage is available.

This build implements manual labor through the wheelbarrow. Industrial automation and the endgame are not yet implemented. One billion rocks are represented as a resource counter and a sample of low-poly geometry, not a billion physics bodies. WebGL is preferred; there is a software canvas fallback. Actual iOS Safari device testing is still required.
