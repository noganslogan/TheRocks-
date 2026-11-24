THE ROCKS. v0.3

Your wife volunteered you to remove one billion rocks from Larry's yard. Pick
them up, haul them to the truck, and spend the rock credits in the shed. The
truck never fills up.

PLAY

Open index.html or serve the repository root, for example with
  python3 -m http.server 8000
For iPhone, open the HTTPS-hosted game in Safari and rotate to landscape.

Desktop: WASD to walk or drive, drag or use arrow keys to look, E or Space to
work/unload, F to enter/exit machinery, and B to open the nearby shed.
Touch: left stick to walk or drive, drag the scene to look, and use the
context button on the right. Hold the action for the jackhammer, vacuum,
and dump-cart pickup. The other machines use tap actions.

Purchase and swap equipment at the shed. Vehicles arrive on the concrete pad
beside it. Park the vehicle with F or Exit. Vehicle cargo stays with the parked
machine and must be unloaded before trading it out. Lower the bulldozer's
blade and drive forward into the pile to collect. Bring the load to the marked
area behind the pickup and use Unload.

CLOUDFLARE

Deploy the repository root as static files from main. Put index.html and the
js/ directory in the same build output directory. The game uses no build
command, third-party runtime dependencies, services or credentials. Blender
and Node are only used for asset authoring and tests.

SAVES AND RENDERING

The game migrates original saves in place. Delivered rocks, credits, owned
gear and carried material retain their values. New saves also record depleted
pile cells, fractured rubble and the active vehicle. One rock deposited earns
one credit. WebGL uses hardware instancing where available. Canvas fallback
uses fewer surface rocks and simpler sorting and lighting.

See CHANGELOG.md for the v0.3 changes and release test coverage. Run the
automated gameplay suite with Node using node tests/release.cjs.
