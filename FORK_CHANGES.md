# Fork changes

What this fork (`sandhilt/calindra-strike`) changed relative to upstream (`gabriel-accetta/calindra-strike`). Kept up to date by the project skill `.claude/skills/record-fork-changes`. This file says what differs and since when. How each feature works is in `README.md` and `AGENTS.md`.

- Upstream compared: `310567f` (`upstream/main`)
- Covered through: `5406091`

## Log

Changes made after the baseline, newest day first.

### 2026-11-26

- Shopping Sul Rio: Natal gets more Christmas: the glass lift cab carries garlands, wreaths and gifts that ride with it (`festive` on the `lift` prop, `addCabDecor` in `client/src/game/render/christmas.ts`, one merged mesh per cab), holly with baubles and a bow hangs beside each lift level sign with the sign face clear, and three snowmen (a new `snowman` prop, merged into the static props mesh) stand on a snow patch in the dead-end corner of each up escalator landing on the Mirante, clear of its exit. `shopping-natal.test.ts` and `client/test/christmas-props.test.ts` pin it.

- The Mirante back wall wainscot (a pale green panel with a charcoal band) no longer runs behind every shop: it was drawn the full width of the gallery, on the same plane as the pharmacy's and boutiques' own back walls, so it showed through them as a flat glass-like slab and its band stood out over their shelves. It now covers only the walkway by the stair bay and the stretch past the last boutique (`lounge` in `shopping-top.ts`), and `shopping-storefronts.test.ts` fails when two panels overlap on that wall.
- Food court staff are no longer taller than players: they stood on the 28 unit kitchen platform. Each kitchen now has a staff aisle cut out of the platform at its left end, and the cook and server stand in it on the deck (`shopping-kitchens.ts`); `shared/test/staff.test.ts` checks every staff member's feet are on the walkable floor.
- Each food court server now has a cash register beside them on the counter, on a steel stand just inside the serving window (`register` in `shopping-kitchens.ts`, look only, inside the kitchen clip). `shared/test/staff.test.ts` checks every server and cashier has a register within reach.
- Shopping Sul Rio ground floor stores and the Mirante pharmacies get staff behind their counters: a cashier plus a till mate per store (seller, stocker, pharmacist or mall cleaner, `TILL_MATE` in `shopping-stores.ts`), each in a closed half of a cubby (`tillCrew`) behind a counter raised to `TILL_HEIGHT` 50 so it cannot be jumped. New roles and their dress are the `ROLE_DRESS` table in `staff.ts`, with brand polos for every ground floor store in `STAFF_UNIFORMS` and the shared `MALL_JANITOR` uniform for cleaners.
- The Shopping Sul Rio atrium loses its tables (the wooden Quiosque and the low wood table) and is spread out more evenly: the central cart, planter and info totem cluster by the lift moves out, and four small closed kiosks (Bobo's, Livraria da Travessura, Méqui, KFG) and two slim LED totems per half fill the empty patches. Kiosks and totems carry digital ad screens that hold each ad and slide to the next, a new `adScreen` prop drawn as one merged mesh over one shared ad strip (`shopping-cover.ts`, `props.ts`, `adScroll` in `prop-motion.ts`), moving only where `ambientMotion` is on.
- The lift level signs are no longer covered: the Natal wreaths over the lift doorways are gone, the signs sit 14 units over the doorway so the drawn lintel and lamp clear them, and `shopping-natal.test.ts` now checks every decoration, not only garlands, against every sign face.
- The Batatas Douradas (`mequi`) sign has narrower arches and a clear gap before its words.
- Store staff are now drawn with the store mannequin model itself (`addMannequin`), dressed as a mannequin `Outfit` in their brand's theme: a polo in the brand colour (Mequi light blue, Burguer Rei chocolate brown with orange, after those chains' real uniforms) and a white chef jacket trimmed in the brand colour for cooks (`STAFF_UNIFORMS`, `staffOutfit` in `shared/src/maps/staff.ts`). The separate staff body, the moving arms and the `staffMotion` quality column are gone.
- `F2` (remappable, **tirar print**) saves a PNG of the 3D view (`client/src/screenshot.ts`). It is browser-only, so the MCP cover test accepts `browser-only` keys with a reason.
- Store staff: a cashier behind each Mirante boutique till (in a cubby the till now closes with side panels), and a cook and a server in every food court kitchen, each in its brand's uniform. They are look only, placed where no player can reach (the boutique tills are 50 units tall, above the jump, and the Pé Leve shoe shelves and the lowest Brinco Center shelf sit clear of the cashier, and their arms move on the high and low tiers (`staff` prop in `types.ts`, `staff.ts` for the uniforms, `client/src/game/render/staff.ts` for the figures, `staffMotion` in `quality.ts`). `shared/test/staff.test.ts` pins the placement.
- Mirrors are their own `mirror` material (shiny silver, opaque) that rings as glass when shot, instead of plaster (`Room.mirror`, `SURFACE_OF`).
- Santas wear the black visor band across the face again.
- Shopping air vents sit where they belong: the Mirante pharmacy no longer has a third grille buried inside its duct, the Mirante boutique grilles sit on the back wall instead of 4 units in front of it, and the store duct grilles are 22 units tall so they no longer fill the 30 unit duct face edge to edge. `shared/test/vents.test.ts` pins it.
- Debug explorer (Konami code, **cenário**): a **sons do cenário** checkbox plays the map's ambient loops and speaker music, and a **movimento** row switches between flying and **andar**, where the walker moves, jumps and crouches under the match's rules and left click fires the selected **arma** with tracers, impacts and surface sounds. Key files: `client/src/debug/scenario-explorer.ts`, `client/src/debug/scenario-walk.ts`.
- Minotauro, the Mirante sports shop, sells more shoes (a shoe table beside the shoe wall), dumbbells on a rack, rackets on a pegboard, footballs and basketballs, rolled yoga mats, water bottles and backpacks, all look-only (`sportsGoods` in `shopping-boutiques.ts`).
- Minotauro, the Mirante sports shop, hangs a try-on mirror on each side wall (`sentauro` in `shopping-boutiques.ts`).
- The ZARRA store is now ZORRA (`brands.ts`, `store-signs.ts`).
- Shooting water splashes: `water` is its own surface (splash sound, pale blue spray) instead of ringing as glass, and still gets the pane impact on the way through (`isPane` in `shared/src/surface.ts`).
- The shopping air ducts are drawn as light galvanised sheet metal (a `duct` look in `buildWorld`: metal texture, low metalness), not dark metal or plaster, and still ring as metal.
- Escalator sides are one straight glass pane and handrail per side along the incline (`addEscalatorGlass` and `addEscalatorBody` in `prop-models.ts`); the stepped glass boxes stay as invisible blockers.
- The lobby and pause menu **issues?** link opens a new issue with the build commit (`__BUILD_COMMIT__`, set in `client/vite.config.ts`), protocol version, browser, window size and language prefilled in the body (`newIssueUrl` in `client/src/feedback.ts`).
- The cafe counter on each Mirante is gone: its gap holds a Cacau Chou chocolate shop with chocolate shelves, a glass display case and the till (`chocolates` in `shopping-boutiques.ts`, placed in `topFloor` in `shopping-top.ts`). Natal garlands skip any that would hang over a neighbouring sign (`shopping-natal.ts`).
- Ray-Bão, the Mirante eyewear boutique, fills with three shelves of frames on its back wall, a central table of open glasses and a try-on mirror on each side wall (`rayBao` in `shopping-boutiques.ts`).
- The five clothing stores of Shopping Sul Rio hang a full-length mirror on each side wall (silver glass in a dark frame, look only), via `Room.mirror` (`shopping-stores.ts`, `room.ts`).
- A winded player pants with deep breaths until the sprint meter refills, slowing and fading over 3 s after (`Panting`, `Sfx.breath`).
- The display car of Shopping Sul Rio is red and more car-like (stepped windshield, side glass, pillars, bumpers, grille, mirrors, rounder wheels with arches), with the same cover solids (`carStand` in `shopping-cover.ts`).
- Shopping air conditioning ducts are metal that stops bullets and leaks air for 2 s when shot (high tier only). The atrium ducts hang from a riser and the food court duct runs above the kitchen hoods instead of through them (`b.duct`, `onDuct`, `DuctLeaks`).
- In Carrapeta Dourada only the Carrapeta holder's guns are gilded (the rest of the match keeps the normal finish), every hammer is drawn as a red and yellow squeaky toy hammer, look only (`GILDED` and `toyHammer` in `client/src/game/render/weapons3d.ts`).
- Shopping Sul Rio: Natal replaces each display car with a reindeer-drawn sleigh and a seated Santa (`shopping-natal.ts`). Protocol 27 keeps client, server and MCP collision maps in sync after removing the car cover.
- Standing and seated Santas reuse the store mannequin body in a Santa suit and the static prop batch (`santa.ts`). The KFG mascot wears a Santa hat in Natal (`store-signs.ts`).
- Natal: the food court tree and its gifts moved to the corner by the rail, off the escalator approaches.
- Bullet impacts: every surface now has a bright layer that cuts through the gunshot (concrete, plaster, ground, cloth, crate, container, wood, tile and plant were too low or too short to hear). `client/test/surface.test.ts` pins it.
- Natal adds garlands beside store logos, rails and pillars, and small Christmas displays inside shops and on food court counters (`shopping-natal.ts`).
- The Natal canopy gains a frost frame and crossbars that anchor the star strings. The falling snow volume ends at the underside of the glass (`shopping-levels.ts`, `shopping-natal.ts`).
- The food court burger chain is now called Batatas Douradas and the Mirante sports store Minotauro, on their signs and in the README (`brands.ts`, `store-signs.ts`).
- Shopping Sul Rio clears its storefronts on all three floors and replaces the atrium ad masts with kiosks, planters, a bench and info totems. The Mirante gains two stationery shops, local shop ventilation sounds and staggered seating and cover (`shopping-cover.ts`, `shopping-top.ts`, `shopping-boutiques.ts`).
- Added LMS and Gincana elimination rounds, a chase camera for eliminated players, and lead announcements across scoring modes. MCP reports round state and alive counts. Protocol 26 adds the two mode IDs.
- The lobby and Esc menu share an **issues?** link with the GitHub mark that opens the fork’s issue tracker (`client/src/ui/issues-link.ts`).
- The first match after the server starts plays a random map and mode from the rotation instead of always the first one (`GameOptions.firstRotation`, drawn in `server/src/index.ts`).
- Day phases ease into each other over 2 minutes instead of 30 seconds, so dusk and dawn drift in rather than snapping (`DAY_TRANSITION_MS` in `shared/src/constants.ts`).
- Capture the Flag objectives appear as team-colored tech backpacks with LED strips and visible gadgets. They ride on player avatars and stand upright at bases and drop points (`client/src/game/render/flags.ts`).
- Shots through glass and water now ring off the pane with the glass impact sound, sparks and a bullet hole before the round stops behind it (`CollisionWorld.tracePane` in `shared/src/physics.ts`, `ClientGame.ringPane`). Before, bullets flew through panes silently and only the wall behind sounded.

### 2026-11-25
- New map Shopping Sul Rio: Natal (`shopping-natal`): the Shopping Sul Rio layout with Christmas decoration (trees, Santas, reindeer, a sleigh, gifts, wreaths, garlands on the Mirante rail, stars hanging from the roof) built on top of the base map in `shared/src/maps/shopping-natal.ts`, with the same gameplay, its own radio station (`shopping-natal` in `shared/src/maps/stations.ts`, track `client/public/music/shopping-natal.ogg`) and its own rotation entry.
- Falling snow in the Natal atrium, under the glass canopy: `MapTheme.snow` drives a client snow layer (`client/src/game/render/snow.ts`, pure motion in `snow-motion.ts`) built only on the `alta` and `leve` tiers (`QualityProfile.fallingSnow`).
- `PROTOCOL_VERSION` 24 to 25 (`shared/src/constants.ts`): the rotation has a fourth map, and a client without it would read the new map index wrongly.
- In a rush hour the defenders' lunch countdown drops two seconds per second instead of one, so it shows the round at the normal pace (`lunchStatus` in `client/src/game/lunch.ts`); the round length itself is unchanged.
- The ad columns carry shopping items up their masts (hanging bags, a sale pennant and a pendant lamp), and the lift has a level sign over each doorway (Térreo, 1º andar, Mirante) drawn from the new `floor` kind in `STORE_BRANDS` (`shopping-cover.ts`, `shopping-top.ts`, `store-signs.ts`).
- Bobi's is now Bobo's and Samsong is Semsunga (display names and signs only, brand ids unchanged); the Semsunga sign is a tilted blue oval with a wide wordmark.
- Every Shopping Sul Rio kitchen, ground floor shop and Mirante boutique has more trade-specific decor (phones, tablets and screens at Semsunga, fitting rooms at the clothes shops, shelves at the pharmacies, and so on), static boxes only (`shopping-kitchens.ts`, `shopping-stores.ts`, `shopping-boutiques.ts`).
- The gallery ad boards no longer stand in front of the store doors: they sit between stores now, three per half instead of four (`shared/src/maps/shopping-cover.ts`).
- Each half of the Mirante gets one more boutique, Calçados Pé Leve and Perfumaria Essência, beside the cafe, whose counter is narrower now (`shared/src/maps/shopping-top.ts`, `shopping-boutiques.ts`, `client/src/game/render/store-signs.ts`).
- Shopping Sul Rio atrium ad columns carry on to the roof with a thin non-solid mast and a hanging sign of the same brand, so they read as held up by the ceiling (`shared/src/maps/shopping-cover.ts`).
- The lobby offers a fullscreen hint and a button on browsers that support fullscreen (`client/src/ui/lobby.ts`).
- Both Konami debug views can enter and exit browser fullscreen from the panel (`client/src/debug/weapon-viewer.ts`).
- The Konami debug mode now lets players fly through any map and shows FPS, CPU and supported GPU frame timings, JS heap when available, and renderer counts in both views (`client/src/debug/weapon-viewer.ts`).
- Forja, Escritório and Shopping Sul Rio have client-side speaker props for optional positional tracks from `client/public/music/`, with a live `musicVolume` control (tracks are not loaded or played while it is 0). The protocol version stays the same because speakers are local scenery and use no wire fields.
- Hurt server bots and the MCP hunt pilot can charge nearby enemies with the hammer and return to a gun when the rush ends (`server/src/bot-temper.ts`, `server/src/bot.ts`).
- `ViewModel` releases owned weapon resources on weapon or skin changes and frees its remaining resources on exit (`client/src/game/render/viewmodel.ts`).
- Restoring or selecting a weapon resets the reload slider to zero (`client/src/debug/weapon-viewer.ts`).
- Weapon viewer graphics tiers apply pixel density and reflection resolution immediately (`client/src/debug/weapon-viewer.ts`).
- The viewer verification recipe uses the sandbox client port, and the tag lookup test checks resolved weapon IDs directly (`weapon-viewer.md`, `debug-viewer.test.ts`).
- The weapon viewer opens by URL (`?viewer&weapon=<tag>&skin=&aim=&reload=`), reports `viewer:ready` or `viewer:error` in the title and has a skin choice (`client/src/debug/`).
- `AGENTS.md` and the `verify-calindra-strike` skill require every weapon to be in the weapon viewer and agents to test weapon changes there.
- The Azeitadora uses dark materials with lime accents by default and keeps its gold and walnut skin in Carrapeta Dourada matches (`client/src/game/render/weapons3d.ts`).
- The AWP scope lenses on the gun model are the dark blue-green coated glass again, replacing the faint clear green one (`client/src/game/render/weapons3d.ts`).
- The Azeitadora airdrop chance outside Carrapeta Dourada went down from 30% to 20%, below the LMG (`CARRAPETA_AIRDROP_CHANCE`).
- `node --run typecheck` passes again: the `goal` helper in `tools/test/carrapeta-goals.test.ts` has an explicit return type.
- The lobby join card carries a lime “BETA” ribbon (`client/src/ui/lobby.ts`, `client/src/styles.css`).
- Added this history file, the `record-fork-changes` skill that maintains it, and the rule in `AGENTS.md` that every change gets an entry.

## Baseline: upstream `310567f` to `cba52de` (2026-11-14 to 2026-11-25)

469 commits (364 without merges), 376 files, +43900 and -2208 lines. Upstream had no commit missing from the fork. This is the net state of the two trees, so features that were added and later removed are not listed.

### Runtime and tooling

- Node 24 or newer runs the TypeScript sources directly. The server has no bundle step, `tsx`, `esbuild` and the `build:server` script are gone, and the Docker image starts `server/src/index.ts`.
- Tests moved from Vitest to `node:test` and now cover `shared`, `server`, `client` and `tools`. The typecheck includes tests and tools.
- Scripts run with `node --run`, npm is pinned in `packageManager`, and the repo has a Nix flake with a direnv shell.
- New developer scripts: `bench`, `mcp`, `tools/bot-floors.ts` (bot movement report) and `tools/sightlines.ts` (map openness).

### Maps

- New map Shopping Sul Rio (`shopping`): three floors, stores, boutiques, pharmacies, food court kitchens, escalators that carry the rider, a shared glass lift in each half that works as a safe room, supply stands, cover and a water fountain.
- Every map has a day, afternoon and night cycle and is sealed so a glider cannot land outside the walls.
- Map data gained flag bases, defusion bases, restaurants, interiors, lifts, supply stands and scenery props.

### Game modes and match flow

- New modes: capture the flag (`ctf`), debug defusion (`defuse`), hora de almoçar (`almoco`, Shopping only) and Carrapeta Dourada (`carrapeta`). The default rotation went from `tdm,ffa` to all six.
- In Shopping debug defusion the attackers start on the Mirante and plant at the ground floor fountain. A bug already planted scores when the match ends, and a dead player follows living teammates.
- Respawn went from 3 s to 5 s, and 12 s in the objective modes. In Carrapeta Dourada, dying while nobody holds it adds 8 s.
- Mode twists: Black Friday rounds halve the defusion fuse, each lunch round names a target restaurant and may be a faster rush hour, and in Carrapeta Dourada only fights with the holder deal damage while somebody holds it, with a rare Batata Quente frenzy.
- Players confirm "pronto" before entering and again after each podium, idle players are kicked, and warmup has infinite reserve ammo.
- Spectator mode with team choice and camera modes.
- Optional friendly fire.

### Weapons and movement

- Sprint with stamina, slide, lean and prone. Silent walk moved from `Shift` to `Alt`.
- Aim down sights for the pistol, rifle, SMG, shotgun and machine gun. The rifle has a red dot.
- The shotgun reloads shell by shell.
- New weapon Azeitadora, a grenade launcher used by the Carrapeta holder. It also drops from airdrops in other modes (30% chance, tuning value).
- Wall and floor sprays.

### Client

- Graphics tiers (`alta`, `leve`, `desempenho`), contact shadow levels and a benchmark.
- Remappable controls, pause menu tabs, primary weapon choice on the "pronto" screen and a weapon side setting.
- Stamina bar, stance icon, role chips, objective banners and weapon icons in the kill feed.
- Animated reloads, AWP bolt, machine gun belt, casings and barrel smoke, and reworked tracers.
- Per surface impact sounds, selectable sound packs, a kill streak announcer, water splashes and ambient loops.
- Radio menus (keys Z, X, V, B and N) with synthesized speech.
- Hidden weapon viewer (Konami code), new lobby cover and a GitHub button.

### Bots

- Bots play every objective mode, patrol around objectives, use lifts, handle stairs better, visit stores and rooms, and talk in chat and radio.
- Sight range now follows `BOT_SKILL`, as aim and reaction already did, and bots turn their view smoothly. Dev bots (`tools/bots.ts`) follow `BOT_SKILL` and play the objectives too.

### AI agents

- New stdio MCP server in `tools/mcp/` that joins as an ordinary player, with line of sight and hearing limits.
- Claude Code plugin (`.claude-plugin/`, `.mcp.json`), `opencode.json`, six skills in `skills/` for playing and hosting, and one for documenting features.
- Project skills in `.claude/skills/` for playing, verifying and bumping the MCP pin.
- `AGENTS.md` and `CLAUDE.md` with the project rules.

### Protocol and server settings

- `PROTOCOL_VERSION` went from 7 to 24, so upstream clients and servers do not interoperate with the fork.
- New settings: `CTF_CAPTURE_LIMIT`, `DEFUSE_SCORE_LIMIT`, `DEFUSE_PLANT_TIMEOUT`, `DEFUSE_PLANT_TIMEOUT_SECONDS`, `CARRAPETA_PICKUP_TIMEOUT_SECONDS`, `RESPAWN_OBJECTIVE_SECONDS`, `FRIENDLY_FIRE`, `READY_KICK`, `READY_KICK_SECONDS`, `IDLE_KICK`, `IDLE_KICK_SECONDS`, `IDLE_KICK_WARMUP_SECONDS`, `RADIO_COOLDOWN_SECONDS`, `RADIO_MAX_PER_WINDOW` and `RADIO_WINDOW_SECONDS`.
