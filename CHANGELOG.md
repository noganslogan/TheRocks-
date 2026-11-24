# THE ROCKS. v0.5

- Added automatic hopper intake for carried loads and held-tool work beside
  the belt. A held jackhammer resumes feeding when a backed-up hopper drains.
- Buddies now walk through the yard, scoop from the rock pile, carry a load
  and deposit at the truck or conveyor. They use THRIVE's 22-bone humanoid
  with walking, pushing, digging, cab-entry and driving animations.
- Added individual Pace, Handling and Machine training upgrades. Assign a
  trained buddy to the bulldozer, hop out to hand it over, then park and take
  it back when needed. Cargo stays with the bulldozer through either transfer.
- Added live worker statuses, a conveyor queue readout and a movable powered
  collection head. Crew jobs, cargo and the pickup position survive reloads.

The release suite simulates a full bulldozer shift in the yard, another buddy
hauling in parallel, handoff and reclaim with saved cargo, the movable pickup,
and uninterrupted jackhammer feed with hopper backpressure.

# THE ROCKS. v0.4

- Split scoop size from carrying capacity. Start with one rock in your hand,
  then buy pockets, a bucket, a backpack, a wheelbarrow, a reinforced
  wheelbarrow or a rolling trash bin. Vehicles keep their own capacities.
- Added five levels each of gather speed, gather amount and run speed.
- Added four buddies you can call from the phone. They work while the game
  is active and deliver real rocks to the truck. The hire prices are 100,
  10,000, 50 million and 500 million rocks.
- Added a phone with a low-poly contact portrait, messages, incoming calls
  and replies. Messages arrive every five active minutes, calls every thirty,
  and ignored notifications escalate.
- Started factory equipment with a fixed conveyor and feed hopper, a powered
  collector and a crusher. Queued material persists across reloads.
- Migrated v0.3 wheelbarrows into the carry progression. Older saves keep
  their tool unlocks, credits, yard state and cargo.

The automated release suite tests carry upgrades, collection rates, each
vehicle, legacy saves, phone schedules and replies, all four buddies and the
factory queue. The phone UI, touch behavior and live rollout still need
verification on a physical iPhone.

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
