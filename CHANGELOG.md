# THE ROCKS. v0.3

- Corrected the shovel blade and pickaxe impact direction. Reworked grips,
  tool proportions, and hand, scoop, strike and push animations. Cups, shovel
  blades, barrows, buckets and dump beds show 3D gravel while loaded.
- Added the steel shovel, reinforced wheelbarrow, sledgehammer, electric
  jackhammer, powered gravel vacuum, motorized dump cart, mini skid steer,
  mini excavator, industrial loader and bulldozer. Fractured rocks leave
  collectible rubble. The driver uses a pickup head, bucket, arm or blade
  depending on the machine.
- Added first-person cockpits and touch and keyboard driving controls.
  The shed handles purchases and the outdoor pad handles delivery.
- Added Larry, built from THRIVE's 22-bone humanoid rig. He checks his watch,
  drinks, sits, inspects the pile, talks, walks, stands with his hands on his
  hips, and takes breaks in the house. His dialogue follows your progress.
- Added local pile cuts and saved rubble. The yard uses a height field, chunked
  meshes, instanced surface gravel in WebGL and a bounded pool for bouncing
  rocks. Delivery capacity is unlimited. Every rock is accounted for through
  excavation, cargo, rubble and unloading.
- Kept the original save key and migrated old tool and fracture progress.
  Static hosting still serves the root index.html and local scripts.

## Release checks

`node tests/release.cjs` exercises the complete purchase chain from bare
hands, touchscreen and keyboard event handlers, capacity and credit rules,
each machine's steering and movement, truck unloading, fracture and save
migration, the final load at one billion, and all eight of Larry's animations.
The suite uses a controlled clock and simulated graphics and DOM calls.
One full purchase chain reached the bulldozer in 66 trips with short test
routes. The final bulldozer has a 12 million rock capacity, so clearing
the entire yard remains a longer job.

The Canvas fallback uses painter sorting. The bulldozer keeps a simplified
windrow in front of its blade. Localized gravel uses visual particles over
the terrain.
