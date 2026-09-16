# Changelog

All notable changes to the **Tabletop Games** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.2] - 2026-09-16 — "Bowling: Lane Oil & Pocket Precision Physics; Darts: Two-Stage Precision Aiming Loop"

### Changed & Overhauled — Bowling (`src/games/Bowling.tsx`)
- **Realistic Lane Oil Dynamics**:
  - Center boards ($|x| < 30$) oiled from foul line to breakpoint ($y = 0.65$) with reduced friction (`0.35x`), creating skid through the heads.
  - Outside boards ($|x| \ge 30$) feature dry maple wood with increased friction (`1.35x`).
  - Backend ($y < 0.65$) is completely dry (`1.75x` friction multiplier), causing hook rotation to bite aggressively into the pocket.
  - Rendered a subtle procedural oil sheen on the center boards up to the breakpoint.
- **Dead-Center "Head-On" Penalty**:
  - Hitting Pin 1 dead center ($|x| < 5.0$) decelerates forward ball velocity sharply (`vy *= 0.22`, `vx *= 0.15`), driving Pin 1 straight back into Pin 5 while deflecting Pins 2 and 3 outward with high lateral velocity (`vx = ±4.5`).
  - Consistently leaves challenging splits (7-10, 4-7, or 6-10) rather than automatic strikes.
- **Pocket Precision Strike Engine**:
  - Strikes require a true pocket entry: hitting between Pin 1 & Pin 3 ($x \in [6.5, 14.5]$) or Pin 1 & Pin 2 ($x \in [-14.5, -6.5]$) at an optimal entry angle ($2^\circ - 4^\circ$).
  - Triggers a violent diagonal cascade: Pin 1 sweeps into 2 $\to$ 4 $\to$ 7, ball drives into 3 $\to$ 5 $\to$ 9 $\to$ 10, and Pin 3 sweeps into 6 $\to$ 10.
- **Calibrated Pin Mass & Flying Collision Radius**:
  - Reduced flying pin collision radius from 21 down to 15, ensuring edge pins (7 and 10) require direct pocket entry or genuine messenger deflection.
  - Pinned edge deflection thresholds: corner pins 7 and 10 require incoming kinetic energy $> 2.8$ to fall.
- **Enhanced Delivery Sensitivity**:
  - Added subtle hand release micro-drift `(Math.random() - 0.5) * 0.0035` to prevent robotic straight swipes.
  - Lateral flick velocity scales hook response with real-time feedback.

### Changed & Overhauled — Darts (`src/games/Darts.tsx`)
- **Two-Stage Tactile Aiming Loop**:
  - **Stage 1 (General Area Positioning)**:
    - Players drag a large stationary base target circle (radius 26, dashed border, theme glow) across the board to select target sectors (e.g. T20, Bullseye, D16).
    - Dynamic floating Sector Pill badge displays the exact targeted sector in real time (e.g. `[ T20 ]`, `[ D16 ]`, `[ BULL ]`).
    - Releasing drag or tapping **"🔒 Lock Aim & Start Drift Timing"** seamlessly transitions to Stage 2.
  - **Stage 2 (Active Drift Reticle & Timed Throw)**:
    - Base target circle locks in place with a visible dashed anchor.
    - An autonomous high-precision crosshair oscillates chaotically around the locked area via three overlapping sine/cosine harmonic frequencies (speed 2.4, 3.8, 5.2).
    - A delicate dashed sightline tether connects the locked base anchor to the drifting crosshairs.
    - Zero auto-aim snapping: tapping **"🎯 THROW DART"** records the exact millisecond coordinates of the reticle.
    - Provided an **"✏️ Adjust"** button to toggle back to Stage 1 repositioning at any time.
- **Persistent Pinned Darts & Chalk Sound Transitions**:
  - Pinned darts remain embedded in the sisal board for all 3 throws of the turn.
  - After the 3rd dart, scores are tallied, a 1400ms visual pause lets players examine the board, and a tactile thud/chalk sound plays as the board resets and turns advance.
  - Subsequent darts (2/3 and 3/3) maintain the locked target position, allowing quick rhythm throws or optional repositioning.

---

## [1.6.1] - 2026-09-16 — "Toy Curling: Power Calibration & Adjustable Curl Dynamics"

### Changed & Tuned — Toy Curling (`src/games/ToyCurling.tsx`)
- **Calibrated Delivery Power & Full-Sheet Dynamic Range**:
  - Re-mapped base speed from `5.5 + power * 5.2` down to `2.2 + power * 5.6`, allowing true soft-weight delivery.
  - Expanded power slider range from `[0.2, 1.0]` down to `[0.05, 1.0]` (5% to 100%), eliminating stone overshoot at low speeds.
  - Added one-tap shot weight preset chips: **Guard** (35%), **Draw** (58%), and **Takeout** (95%) with dynamic weight label indicators (`Short`, `Guard`, `Draw`, `Back`, `Takeout`).
- **Adjustable Curl Direction & Strength**:
  - Added **Straight** shot option alongside **In-Turn** (curves left) and **Out-Turn** (curves right).
  - Added an adjustable **Curl Spin** slider from 5% to 100% with one-tap presets (**Gentle** 20%, **Medium** 40%, **Sharp** 75%), cleanly disabled when Straight is selected.
  - Re-engineered rotational curl physics: curl torque now scales with forward speed (`(Math.abs(vy) / 5.0)` with coefficient `0.024`), ensuring lateral drift smoothly settles to zero as the stone stops instead of veering indefinitely into sideboards.
- **Dynamic Curved Trajectory & Ghost Stone Landing Preview**:
  - Replaced the static straight aiming line with forward step-simulated curved trajectory projection on the ice sheet.
  - Displays a target Ghost Stone at the predicted landing position, glowing player-color when valid and soft-red when out-of-bounds or short of the hog line.
- **Hog Line Rule Enforcement**:
  - Automatically identifies delivered stones that fail to cross the red Hog Line (`y > 240`) as "hogged" and removes them from play with sound feedback.
- **Refined Controls Deck**:
  - Compact, ergonomic 3-row layout with aim angle slider, 0° reset button, curl direction buttons, weight presets, curl spin presets, and glowing tactile delivery button.

### Added — High-Resolution iOS App Icon & PWA Manifest
- **Full-Bleed Luxury Tabletop App Icon**:
  - Custom high-resolution master icon depicting a royal cobalt-blue turned-wood pawn and an opposing crimson-red lacquer medallion with a golden royal crest, set against a dark herringbone mahogany wood board with brass inlay. Strictly zero dice.
  - Generates seamless full-bleed coverage with no pre-baked borders or double-corner clipping on iOS squircle masks.
- **Multi-Resolution Icon Suite**:
  - `apple-touch-icon.png` and dedicated sizes (`180x180`, `167x167`, `152x152`, `120x120`) for iPhones, iPads, and iOS Desktop Web Clips.
  - `pwa-512x512.png` and `pwa-192x192.png` with standard and maskable support.
  - `favicon.ico`, `favicon-32x32.png`, and `favicon-16x16.png` for desktop browsers.
  - `site.webmanifest` and `manifest.json` configured for standalone full-screen mobile play.
  - iOS meta tags configured in `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-mobile-web-app-title`.

---

## [1.6.0] - 2026-09-16 — "Expansion: Toy Curling, Hex, Matching, Nine Men's Morris, Hare and Hounds, and Hit and Blow"

### Added — 6 Authentic Tactile Games
- **Toy Curling (`src/games/ToyCurling.tsx`)**:
  - **Frosted Pebble Ice Sheet**: Top-down ice sheet simulation with blue, white, and red concentric rings ("the house") and central 4-foot button.
  - **Granite Curling Stones**: Polished granite stones with brass gooseneck handles (Cobalt Blue for P1, Crimson Red for P2).
  - **Aim & Curl Delivery**: 2-step launch with aim vector angle, in-turn vs. out-turn rotational curl toggle, and drag-back power meter.
  - **Tactile Sweeping Mechanic**: Rapid horizontal swiping ahead of moving stones generates broom brushing and icy particle effects, reducing friction from `0.9855` to `0.9935` and holding the line.
  - **Elastic Collisions & House Scoring**: 2D circle collisions knock opponent stones out; end scoring awards 1 point per stone closer to the button than opponent's nearest stone.
- **Hex (`src/games/Hex.tsx`)**:
  - **Mahogany Diamond Rhombic Board**: 11x11 carved hexagonal board with color-coded border lines (Cobalt Blue for P1 connecting Top-Left to Bottom-Right, Crimson Red for P2 connecting Top-Right to Bottom-Left).
  - **Translucent Acrylic Gems**: Glossy blue sapphire and red ruby gems that snap into recesses with a crystalline glass tink sound.
  - **Breadth-First Search (BFS) Win Engine**: Detects unbroken connected chains between opposing edges; draws mathematically impossible; victory path highlighted with golden aura.
- **Matching / Memory (`src/games/Matching.tsx`)**:
  - **Green Baize Mat & 6x4 Grid**: 24 linen-embossed cards with gold filigree backs containing 12 unique matching pairs of procedural tabletop icons.
  - **3D Card Flip Perspective**: Smooth CSS `rotateY(180deg)` flip animation.
  - **Consecutive Turn Rule**: Matching a pair keeps it face up, scores 1 point, and grants an immediate bonus turn; mismatches flip back after an 850ms visual pause.
- **Nine Men's Morris (`src/games/NineMensMorris.tsx`)**:
  - **Blonde Oak Board**: 24-point board of 3 concentric squares joined by 4 crossbars.
  - **Turned-Wood Pieces**: 9 dark walnut pieces for P1 and 9 light maple pieces for P2.
  - **Three-Phase Turn Engine**: Placement Phase (18 reserve placements), Movement Phase (sliding along connected paths), and Flying Phase (jumping anywhere when down to 3 pieces).
  - **Mill Capture Rule**: Forming a 3-in-a-row mill captures an opponent piece (protected if in an active mill unless all pieces are in mills).
- **Hare and Hounds (`src/games/HareAndHounds.tsx`)**:
  - **Carved Weathered Stone Slab**: 11-node French military graph with runic pathways.
  - **Asymmetric Mechanics**: Player 1 commands 3 bronze Hounds (can only advance forward or move vertically); Player 2 commands 1 copper Hare (can move in all directions).
  - **Win Detection**: Hounds win by trapping and immobilizing the Hare; Hare wins by slipping past the hound line or surviving 10 non-advancing moves.
- **Hit and Blow (`src/games/HitAndBlow.tsx`)**:
  - **Slanted Wooden Console**: 10-row pegboard with a 4-peg secret vault, brass shield, and side indicator sockets.
  - **Vibrant Peg Palette**: Red, Blue, Green, Yellow, Orange, and Purple molded plastic pegs.
  - **Dual Game Modes**: *Vs. Codebreaker* (Player 1 sets secret code behind shield; Player 2 guesses) and *Equal Duel* (alternating guesses against a mystery code).
  - **Accurate Deduction Clues**: Black peg for Hits (correct color & position), White peg for Blows (correct color, wrong position).

### Added — Synthesized Material Audio (`src/utils/feedback.ts`)
- `playCurlingGlideSound()`: Granite-on-pebbled-ice sliding rumble.
- `playCurlingSweepSound()`: Rapid broom sweep whoosh.
- `playCurlingClackSound()`: Heavy granite stone impact clack.
- `playCardFlipSound()`: Crisp linen paper card flip snap.
- `playWoodPieceMoveSound()`: Solid turned-wood piece tap.
- `playStoneSlideSound()`: Resonant stone scrape on carved slab.
- `playPegSnapSound()`: Tactile plastic peg socket pop.
- `playVictorySound`: Alias to `playVictoryFanfare`.

### Added — UI & Catalog Integration
- **Procedural SVG Icons**: Designed 6 rich SVG icons in `src/components/GameIcon.tsx`.
- **Main Menu**: Registered all 6 games in `src/components/MainMenu.tsx` (`GAME_CATALOG`) and updated title to **22 Classic 2-Player Games**.
- **Rules Documentation**: Added complete rules, objectives, and pro-tips in `src/types/rules.ts` (`GAME_RULES`).
- **App Router**: Configured routing in `src/App.tsx`.

---

## [1.5.0] - 2026-09-16 — "Mechanical Balancing, Physics Overhaul & Global Turn UX Streamlining"

### Changed — Global Turn UX Streamlining
- **Eliminated Disruptive `TurnTransitionModal` Across All Turn-Based Games**:
  - Removed full-screen modal interruptions from all 11 turn-based titles: `Mancala`, `DotsAndBoxes`, `Renegade`, `Checkers`, `Backgammon`, `Carrom`, `YachtDice`, `Billiards`, `Darts`, `Bowling`, and `MiniShogi`.
  - Preserved terminal `GameOverModal` on decisive outcomes, matches, and draws.
- **Enhanced `GameHeader.tsx` Turn Indicator**:
  - Introduced an animated, non-blocking persistent active turn badge/pill with vibrant glowing borders and soft background accents (Cobalt Blue for Player 1, Crimson Red for Player 2).
  - Added a 200ms spring-pulse keyframe animation (`animate-turn-pulse`) triggered on every turn change with audio-tactile feedback.

### Changed — Billiards (8-Ball) Orientation & Controls (`src/games/Billiards.tsx`)
- **Horizontal Landscape Orientation**:
  - Flipped table geometry 90 degrees to landscape layout (`TABLE_WIDTH = 620`, `TABLE_HEIGHT = 340`) for an expansive horizontal playing surface.
  - Reconfigured 6 drop pockets (4 corners and 2 side pockets along the top and bottom longitudinal rails).
  - Rotated the triangle rack to the right foot spot (`x = 446`, `y = 170`) and cue ball to the left headstring (`x = 155`, `y = 170`).
- **Horizontal Cue Aiming & Power Slider**:
  - Realigned cue aiming vectors and fine-tuning sliders along the horizontal axis with directional trajectory raycasting and collision reflections.

### Changed — Darts Dynamic Aim Mechanic (`src/games/Darts.tsx`)
- **Eliminated Direct-Click Snapping**:
  - Disabled instant-throw snapping to board numbers to prevent trivial 180s and maintain authentic dexterity challenge.
- **Harmonic Lissajous Drifting Reticle**:
  - Implemented dual-frequency Lissajous harmonic drift oscillation (`Math.sin(time * 0.0023)`, `Math.cos(time * 0.0031)`).
  - Added touch drag to reposition base aim offset with smooth damping.
  - Introduced tactile Throw button and touch release trigger registering exact floating coordinates at the release millisecond with slight physical aerodynamic dispersion.

### Changed — Bowling Physics Balancing & Stance Controls (`src/games/Bowling.tsx`)
- **Pin Visual Scale & Hitbox Enlargement**:
  - Enlarged pin visual scale by ~28% (`scale = 0.50 + pin.y * 0.15`) with widened maple bellies, heads, and dual red neck stripes.
  - Increased direct ball collision hitbox by ~28% (`dist < 18` vs `14`) and pin-to-pin cascade reaction distance by ~31% (`dist < 21` vs `16`).
- **Horizontal Stance Repositioning & Targeting Alignment Guide**:
  - Implemented direct touch-and-drag ball positioning across the approach line (`ballStartX` from `-65` to `+65`).
  - Added real-time lane alignment indicator projecting dotted targeting trajectories and foul line board markers toward the pin pocket.
- **Tightened Strike Realism & Pocket Thresholds**:
  - Clean pocket strikes ($ball.x \in [5, 15]$ for 1-3 or $[-15, -5]$ for 1-2 pocket) trigger violent lateral deflection through edge pins and driving ball deflection through the 5-pin, creating a 10-pin domino strike.
  - Head-on center hits ($|ball.x| < 4$) absorb ball momentum and drive straight back into pin 5 without lateral spray, leaving authentic split leaves (7-10 or 4-7).
  - Corner pins 7 and 10 require high kinetic energy impulse to tumble, preventing cheap edge pins on weak touches.

---

## [1.4.0] - 2026-09-16 — "Tactile Physical Classics: Billiards, Darts, Bowling & Mini Shogi"

### Added — 4 Tactile Physical Games
- **Billiards (8-Ball) (`src/games/Billiards.tsx`)**:
  - **Visuals & Table Design**: Baize-green felt slate table with rich beveled mahogany wood rails, metal corner castings, and 6 deep leather drop-pockets.
  - **Phenolic Resin Balls**: 16 balls (Cue ball, Solids 1–7, 8-Ball, Stripes 9–15) rendered with high-contrast radial gradients, number discs, and specular gloss spots.
  - **Physics Engine**: Continuous 2D rigid-body elastic collisions with restitution (`0.94`), rolling friction (`0.988`), and cushion bounce reflections.
  - **Tactical Aiming & Ghost Trajectory**: Rotary aim wheel and direct table drag with real-time raycasting that displays the dashed cue trajectory, ghost impact circle, and target deflection vector.
  - **Controls & Ball-in-Hand**: Power meter slider with dynamic strike velocity; ball-in-hand drag positioning on scratch fouls.
  - **Official 8-Ball Rules**: Open table tracking, group assignment (Solids vs. Stripes), turn continuation on legal pots, premature 8-ball loss, and legitimate 8-ball victory.
- **Darts (`src/games/Darts.tsx`)**:
  - **Bristle Sisal Board**: Regulation 20-sector sisal dartboard with thin wire spider, outer double ring (2x), inner triple ring (3x), single bull (25), and double bull (50).
  - **Swipe-to-Throw Engine**: Touch/pointer swipe tracking release velocity and angle with subtle natural breathing crosshair sway.
  - **Tactile Pinned Darts**: Brass barrel darts with nylon flights cast directional drop shadows and remain pinned into the board for all 3 throws of each turn.
  - **Dual Game Modes**:
    - **501 Countdown**: Running score subtraction, bust reset logic, and double-out checkout toggle.
    - **Cricket Mode**: Interactive tracking of sectors 15–20 and Bullseye with closure marks (`/`, `X`, `⨂`) and point scoring.
  - **Pub Chalkboard**: Real-time chalk tally sheet with chalk scribble sound effects.
- **Bowling (`src/games/Bowling.tsx`)**:
  - **Lacquered Maple Alley**: 2.5D perspective lane with light sheen reflections, foul line, target chevron arrows, and dark gutters.
  - **10-Pin Triangle Formation**: Weighted white maple pins with dual red neck stripes standing in regulation triangle layout.
  - **Ball Physics & Hook**: Swipe forward to roll; swipe curvature imparts lateral spin/hook onto swirling metallic-flake urethane bowling balls (P1 Cobalt Blue, P2 Crimson Red).
  - **Chain Reaction Pin Collisions**: Circle-circle collision cascade scattering struck and flying pins realistically.
  - **Authentic 10-Frame Scoring**: Full Strike (X), Spare (/), and open frame calculations with 10th-frame bonus rolls and overhead retro LED dot-matrix scorecard.
- **Mini Shogi (5x5) (`src/games/MiniShogi.tsx`)**:
  - **Paulownia Wood Board & Koma Tiles**: 5x5 engraved board with traditional pentagonal boxwood wedge tiles featuring bold calligraphic kanji and romanized subtitles.
  - **Side Reserve Trays (*Komadai*)**: Displays captured pieces ready for tactical piece drops.
  - **Complete Rules**: Movement validation for King, Gold, Silver, Bishop, Rook, and Pawn.
  - **Promotion Logic**: Single-rank promotion in opponent back rank (Pawn -> Tokin, Silver -> Narigin, Bishop -> Horse, Rook -> Dragon).
  - **Drop Rule (*Uchi*)**: Drop captured pieces onto empty squares with Nifu (two pawns) and checkmate restrictions.

### Added — Synthesized Material Audio (`src/utils/feedback.ts`)
- `playBilliardsHitSound(intensity)`: High-frequency resin-on-resin ball click with rapid exponential damping.
- `playPocketDropSound()`: Muffled leather cup drop thud.
- `playCueStrikeSound(power)`: Leather cue tip impulse pop.
- `playDartHitSound()`: Crisp steel needle snap followed by low sisal bristle resonance.
- `playChalkSound()`: Friction-modulated filtered noise burst simulating chalk on slate.
- `playBallRollSound()`: Heavy rolling rumble on lacquered maple wood.
- `playPinCrashSound(count)`: Multi-frequency hardwood pin collision burst with harmonic ringing.

### Added — Application Integration & Icons (`GameIcon.tsx`, `MainMenu.tsx`, `App.tsx`, `rules.ts`)
- Designed 4 procedural inline SVG icons with high Clubhouse-style detail for Billiards, Darts, Bowling, and Mini Shogi.
- Registered game metadata in `GAME_CATALOG`, route handling in `App.tsx`, and comprehensive rules in `GAME_RULES`.

---

## [1.3.0] - 2026-09-16 — "Tactile Clubhouse Tabletop Visual & Audio Overhaul"

### Added — Environmental Lighting & Design System (`index.css`, `tailwind.config.js`)
- **Procedural Wood-Plank Tabletop Background**:
  - Implemented `.wood-table-bg` in `index.css` featuring SVG `<feTurbulence>` and `<feColorMatrix>` procedural wood grain data URI.
  - Added simulated plank seams, directional warm ambient lighting vignette (`radial-gradient(ellipse at 50% 35%, ...)`), and subtle linear plank highlights.
- **3-Tier Tactile Elevation Tokens**:
  - Configured `table-recess` (`shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]`), `table-flat` (`shadow-[0_2px_4px_rgba(0,0,0,0.3)]`), and `table-lifted` (`shadow-[0_8px_20px_rgba(0,0,0,0.45)]`) in `tailwind.config.js` and `index.css`.
  - Added spring transition timing `cubic-bezier(0.34, 1.56, 0.64, 1)` for snappy, physical piece interactions.

### Added — Synthesized Material Audio Engine (`src/utils/feedback.ts`)
- **High-Fidelity Procedural Web Audio**:
  - `playGlassTinkSound()`: Dual high-frequency sine waves (2400 Hz & 3600 Hz) with rapid 60ms exponential decay, simulating glass cabochon marbles striking wood and other stones.
  - `playPlasticPlinkSound()`: Rapid frequency drop from 680 Hz to 240 Hz with a subtle second harmonic, emulating lightweight hollow plastic checker discs clicking into place.
  - `playWoodClackSound()`: Filtered low-frequency hollow thud (180 Hz to 75 Hz) through a bandpass filter with slight noise attack, mimicking solid hardwood and Yunzi slate stone placement.

### Changed — Material & Component Overhauls across Games
- **Mancala (`src/games/Mancala.tsx`)**:
  - Transformed board into a beveled blonde-wood/mahogany trough with deep carved oval/circular hollow pits (`table-recess`).
  - Rendered multi-stop glass cabochon marbles (sapphire, emerald, amber, ruby, amethyst, topaz) with contact drop shadows and white specular highlights.
  - Wired `playGlassTinkSound` on marble sowing and store drops.
- **Connect Four (`src/games/ConnectFour.tsx`)**:
  - Redesigned rack as a molded matte plastic vertical frame with structural ribs, molded base stand feet, and deep cylindrical channel slots.
  - Upgraded pieces to tournament checker discs with concentric ridges, sunken center squares, glossy top-edge rims, and last-move ring indicator.
  - Integrated `playPlasticPlinkSound` upon column drops.
- **Gomoku (`src/games/Gomoku.tsx`)**:
  - Overhauled playing board to authentic honey bamboo (`#deb887`) with 1px dark umber grid lines and traditional hoshi star points.
  - Rendered Yunzi biconvex slate (matte black gradient) and shell (warm pearlescent white gradient) stones with realistic contact drop shadows.
  - Integrated `playWoodClackSound` on stone placement.
- **Checkers (`src/games/Checkers.tsx`)**:
  - Re-styled board squares with baize green and deep forest felt inlays surrounded by hardwood perimeter bevel trim.
  - Upgraded pieces to turned-wood / bakelite checkers with dual concentric routed rings, beveled edge shadows, and metallic gold King crowns.
  - Integrated `playWoodClackSound` on moves and jumps.
- **Backgammon (`src/games/Backgammon.tsx`)**:
  - Upgraded board field with rich baize felt inlays and hardwood dividers.
  - Enhanced checkers with turned-wood routed rings and contact drop shadows.
  - Upgraded dice to 3D acrylic dice with rounded corners, diagonal face sweeps, and recessed circular pips.
  - Integrated `playWoodClackSound` on checker moves.
- **Speed (`src/games/Speed.tsx`)**:
  - Added physical cardstock qualities: subtle linen-weave surface, rounded borders, and dynamic elevation (`table-lifted`) with hover-lift responses.
  - Upgraded draw piles with intricate geometric SVG card back patterns.
- **Yacht Dice (`src/games/YachtDice.tsx`)**:
  - Overhauled dice renderer to rounded-cube acrylic dice (`rx="18"`) with deep recessed circular pips, inner radial shading, and glossy diagonal face sweeps.
  - Applied `table-lifted` elevation on held dice and `table-flat` on scorecard paper.

---

## [1.2.9] - 2026-09-16 — "Toy Tennis Paddle Collision Normalization & Gomoku Seamless Turns"

### Fixed — Physics & Collision Hitboxes (`src/games/ToyTennis.tsx`)
- **Normalized Paddle Hitbox Mathematics**:
  - Refactored `interface Paddle` to explicitly define both `x` and `y` center coordinates.
  - Symmetrically calibrated baseline anchor centers: Player 2 at `y = 32` (top baseline) and Player 1 at `y = s.height - 32` (bottom baseline), with height `14` and width `78`.
  - Derives all bounding boxes uniformly using `y ± height / 2` and `x ± width / 2`.
  - Aligned canvas rendering directly with center coordinates (`p.x - p.width / 2`, `p.y - p.height / 2`), ensuring zero offset between visual paddle sprites and physical hitboxes.
- **True Ground Coordinate Collision Engine**:
  - Removed visual Z-offset distortion (`ballP2VisualY = b.y - b.z`) from collision detection, restoring pure ground coordinate `b.y` for 2D plane physics.
  - Corrected boundary hit conditions and sign conventions between top and bottom paddles:
    - Player 1 (Bottom, moving down): hits top face `b.y + b.radius >= p1Top && b.y - b.radius <= p1Bottom`, reseats cleanly at `b.y = p1Top - b.radius`.
    - Player 2 (Top, moving up): hits bottom face `b.y - b.radius <= p2Bottom && b.y + b.radius >= p2Top`, reseats cleanly at `b.y = p2Bottom + b.radius`.
  - Eliminated premature bounces in front of Player 1 and pass-through bounces behind Player 2.

### Changed — UX & Flow Optimization (`src/games/Gomoku.tsx`)
- **Eliminated Disruptive Turn Modals**:
  - Removed `TurnTransitionModal` and hand-off delay timeouts from Gomoku, transitioning it to a fluid shared-screen board game experience matching Connect Four.
  - Tapping an intersection now immediately places the stone and seamlessly advances the turn to the opponent in the header status.
- **Added Subtle Last-Move Indicator**:
  - Tracked `lastMove` coordinate on stone placement.
  - Rendered a pulsing red pip on the center of the most recently placed stone so players can instantly spot their opponent's play.

---

## [1.2.8] - 2026-09-15 — "Toy Tennis Paddle Collision & Visual Alignment Calibration"

### Fixed — Physics & Visual Alignment (`src/games/ToyTennis.tsx`)
- **Resolved Visual & Physical Offset on Paddle Contact**:
  - Identified root cause: The 3D altitude projection rendered the ball at `ballVisualY = b.y - b.z`. Because $z > 0$, the visual ball appeared displaced upward (toward the top of the court) relative to its physical ground coordinate $b.y$.
  - This caused downward returns to visual-bounce in front of the bottom (Blue) paddle, while upward returns appeared to penetrate behind the top (Red) paddle before registering contact.
- **Synchronized Paddle Geometry & Strike Plane**:
  - Bound bottom paddle collision directly to its rendered position: `p1Top = s.height - 35`, reseating the ball cleanly on the paddle's front face (`b.y = p1Top - b.radius`).
  - Calibrated top paddle collision using projected visual position: `ballP2VisualY = b.y - b.z`, ensuring contact registers as soon as the visual ball touches the bottom face of the top paddle (`b.y = p2Bottom + b.radius`).
  - Reset altitude to ground contact level ($z = 2$) upon paddle strike so the ball and paddle faces make direct, satisfying physical contact without hovering or clipping.

---

## [1.2.7] - 2026-09-15 — "Mancala Marble Overhaul & Universal Device Scaling"

### Changed — Visuals & Responsiveness (`src/games/Mancala.tsx`, `src/games/ConnectFour.tsx`, `src/games/Checkers.tsx`, `src/games/Gomoku.tsx`, `src/games/DotsAndBoxes.tsx`, `src/games/Renegade.tsx`, `src/games/Backgammon.tsx`, `src/games/YachtDice.tsx`, `src/games/Speed.tsx`, `src/games/AirHockey.tsx`, `src/games/ToyTennis.tsx`, `src/games/Carrom.tsx`, `src/components/MainMenu.tsx`)
- **Mancala Marble Visual Overhaul (`src/games/Mancala.tsx`)**:
  - Re-engineered marble rendering with more than 2x larger dimensions (radius increased from 4px to 8.8px in pits and 7.2px in stores).
  - Designed tactile 3D spheres with individual SVG `radialGradient` shading (specular glass highlight, primary gem tone, and deep shadow rim), realistic pit floor drop shadows, and organic diamond/radial clustering.
  - Upgraded pit counts and store counts with high-contrast, shadowed pill badges (`bg-black/70 px-2 py-0.5`).
- **Universal Multi-Device Responsive Scaling**:
  - Refactored board containers across all 12 games to scale seamlessly from iPhone/mobile viewports (`max-w-xs`, `max-w-sm`), to iPad/tablets (`sm:max-w-md`, `sm:max-w-xl`), up to desktop PC screens (`md:max-w-lg`, `md:max-w-2xl`, `max-w-5xl`).
  - **Mancala**: Expanded trough from mobile `max-w-sm` up to `md:max-w-2xl` with taller stores (`md:h-72`) and wider pit buttons.
  - **Connect Four & Checkers & Renegade & Dots and Boxes**: Board racks expand up to `md:max-w-lg` with scalable grid cells.
  - **Gomoku**: Board expands up to `md:max-w-xl` with clear bamboo intersections.
  - **Backgammon & Yacht Dice**: Containers expand up to `md:max-w-2xl` and `md:max-w-3xl` with enlarged dice and wider point triangles.
  - **Air Hockey, Toy Tennis, Carrom**: Real-time canvas games now scale up to `md:max-w-lg` while preserving internal physics resolution and dynamic device-pixel ratio calibration.
  - **Main Menu**: Responsive catalog grid now adapts from 2 columns on mobile to 3 columns on tablet/iPad and 4 columns on desktop PC (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-5xl`).

---

## [1.2.6] - 2026-09-15 — "In-Game Rules & Instructions Modal"

### Added — UX & Game Instructions (`src/types/rules.ts`, `src/components/GameRulesModal.tsx`, `src/components/GameHeader.tsx`, `src/components/MainMenu.tsx`)
- **Game Rules Engine & Definitions (`src/types/rules.ts`)**:
  - Authored comprehensive, structured instructions for all 12 tabletop titles (Mancala, Connect Four, Dots & Boxes, Speed, Yacht Dice, Renegade/Reversi, Air Hockey, Toy Tennis, Carrom, Gomoku, Checkers, Backgammon).
  - Each guide includes: Objective, Initial Board Setup, Step-by-Step "How To Play" flow, Winning Conditions, and Strategic Pro Tips.
- **Dedicated Game Rules Modal (`src/components/GameRulesModal.tsx`)**:
  - Implemented Clubhouse-styled, tactile dialog with blurred backdrop (`backdrop-blur-md bg-black/80`).
  - Formatted with organized category badges, numbered step chips, highlighted objective cards, and strategic pro tips.
  - Interactive dismiss buttons with haptic feedback and tap sounds.
- **Universal Header "Rules" Button (`src/components/GameHeader.tsx`)**:
  - Integrated an amber pill button (`📖 Rules`) into the top header of all 12 games, allowing players to pause and check rules at any point during active gameplay without interrupting turn state or reset progress.
- **Main Menu Quick-Inspection Badges (`src/components/MainMenu.tsx`)**:
  - Added a `?` badge to every game tile in the Main Menu catalog, enabling users to preview game instructions before starting a match.

---

## [1.2.5] - 2026-09-15 — "Yacht Dice Vertical Left Layout & 3D Rolling Animation"

### Changed — Layout & Visual Animation (`src/games/YachtDice.tsx`, `src/index.css`)
- **Vertical Left-Hand Dice Column & Right-Hand Scorecard**:
  - Replaced the horizontal top dice bar with a dedicated vertical arcade-style dice tray (`w-24 sm:w-28`) along the left edge.
  - Positioned all 5 3D dice vertically with tactile hold indicators (`HELD` badge + amber focus ring + rightward offset) for easy one-handed thumb interaction.
  - Placed the primary "Roll Dice" button directly below the vertical dice tray.
  - Positioned the full 12-category scorecard table, Upper Bonus tracker, and running total scores on the right-hand side.
- **Dynamic 3D Rolling & Tumbling Animation**:
  - Added multi-stage rolling state (`isRolling: boolean`) with `@keyframes diceTumble` (360° tumbling, scale shifts, and vertical recoil).
  - Integrated rapid audio feedback (`playTapSound()`) and face jitter ticks over a 450ms animation sequence before locking onto the final rolled numbers.
  - Disabled holds and category selection while dice are in motion to ensure crisp input synchronization.

---

## [1.2.4] - 2026-09-15 — "Connect Four Streamlined Inline Turns"

### Changed — UX & Turn Flow (`src/games/ConnectFour.tsx`)
- **Eliminated Repetitive "Ready" Confirmation Popups**:
  - Removed `TurnTransitionModal` from Connect Four moves, allowing players sitting side-by-side or sharing the phone to drop pieces back-and-forth without hitting "Ready" every turn.
- **Ultra-Clear Active Player Visuals**:
  - Added a prominent glowing turn badge above the rack with pulsating player indicator ring (`Player 1's Turn (Cobalt)` vs `Player 2's Turn (Crimson)`).
  - Dynamic column drop indicator arrows and drop preview dots match the active player's team color.
  - Active player cards in `GameHeader` highlight with real-time glow and pulsing beacon dots.

---

## [1.2.3] - 2026-09-15 — "Toy Tennis Trajectory Recalibration & Net Clearance Engine"

### Fixed — Toy Tennis Physics & Rally Continuity (`src/games/ToyTennis.tsx`, `src/utils/feedback.ts`)
- **Ball Arc & Gravity Recalibration**:
  - Calibrated gravity to a gentle pull (`gravity = 0.22`, dampening = `0.85`), preventing premature altitude drops before crossing the net cordon.
  - Calculated upward launch impulse on every baseline return (`vz = Math.max(Math.abs(vy) * 0.52 * sweetSpot, 5.8)`), guaranteeing the trajectory's apex comfortably clears the center net.
  - Scaled visual projected ground shadow dynamically with altitude (`shadowScale = 1 - z / 80`), maintaining crisp 3D depth perception.
- **Forgiving Net Clearance Logic**:
  - Defined explicit net clearance envelope: `NET_HEIGHT = 16px`, `NET_THICKNESS = 8px`.
  - Balls crossing with `z >= NET_HEIGHT` clear cleanly without faults and trigger a crisp synthesized air swish audio effect (`playNetSwishSound()`).
  - Balls physically clipping below the threshold trigger a damped net tape rebound, a distinct visual `⚠️ Net Fault!` flash overlay, error audio buzz (`playErrorBuzz()`), and haptic feedback.
- **Sweet Spot Velocity Multiplier & Serve Assist**:
  - Centered paddle hits provide up to a 25% boost to upward arc and speed for satisfying returns.
  - Serves guaranteed a high arching launch (`vz = 6.5`, clearing the net with >10px altitude margin).
- **Control & Desktop Support**:
  - Added continuous Pointer Events tracking with coordinate normalization and desktop keyboard control (`A/D` for Player 2, Left/Right arrows for Player 1).
  - Sustained rally counter tracking consecutive hits in real time.

---

## [1.2.2] - 2026-09-15 — "Air Hockey Interaction & Multi-Touch Drag Overhaul"

### Fixed — Air Hockey Touch & Serve Mechanics (`src/games/AirHockey.tsx`)
- **Robust Pointer Events & Coordinate Normalization**:
  - Replaced legacy touch listeners with HTML5 Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`) and pointer capture (`e.currentTarget.setPointerCapture(e.pointerId)`).
  - Normalized screen client coordinates to internal canvas resolution using `rect.left/top` offsets and `scaleX / scaleY` scaling multipliers.
  - Added `touch-action: none;` and `user-select: none;` inline styles to the canvas to guarantee mobile swipe gestures are never captured by browser viewport scrolling or pull-to-refresh.
- **Zone Touch Snapping**:
  - Players can touch or drag anywhere within their defending half to instantly snap and drag their mallet without requiring pixel-perfect touches directly on the small mallet circle.
  - Player 1 clamped to bottom half (`y > canvas.height / 2 + malletRadius`); Player 2 clamped to top half (`y < canvas.height / 2 - malletRadius`).
- **Puck Auto-Serve & Anti-Stagnation Engine**:
  - Added floating animated `"⚡ Tap To Serve"` prompt overlay on match start and after each goal scored.
  - Tapping anywhere in the arena launches the puck toward the receiving player with a randomized angular impulse.
  - Added anti-stagnation monitoring: if the puck remains nearly stationary (speed < 0.25) for more than 2 seconds, an automatic drift impulse pushes it back into active play.
- **Desktop Keyboard & AI Fallback**:
  - Added mouse movement tracking for Player 1, keyboard controls (`WASD` for Player 2, Arrow Keys for Player 1, and `Space/Enter` to serve), plus an automated defensive AI for Player 2 when playing solo on desktop.

---

## [1.2.1] - 2026-09-15 — "Animation Lock Architecture & Delayed Turn Hand-Off"

### Fixed — UX Flow & Animation Visibility
- **Decoupled Move Resolution from Turn Hand-Off** (`src/games/ConnectFour.tsx`, `src/index.css`):
  - Introduced `isAnimating: boolean` state flag locking user input immediately while keeping `gameStatus = 'active'`.
  - Replaced immediate cell drop with dedicated falling disc element governed by dynamic fall duration (`380ms + row * 38ms`) and gravity acceleration curve (`cubic-bezier(0.45, 0, 0.55, 1)`).
  - Procedural landing impact: Two-stage micro-bounce keyframes (`.animate-disc-fall`) with sound pops (`playTapSound()`, `playBounceSound()`) timed precisely to bottom landing impact.
  - Delayed pass-and-play turn overlay (`TurnTransitionModal`) and win checks until piece completely finishes falling and settles.
- **Universal Animation Settle Hand-off**:
  - **Mancala** (`src/games/Mancala.tsx`): Extended post-sow settling window to 450ms so players watch marble distribution and captures settle before turn transition modal mounts.
  - **Checkers** (`src/games/Checkers.tsx`): Wrapped moves and multi-jumps in animation lock; delayed modal transition by 420ms so players observe diagonal moves, jumps, and king crownings.
  - **Renegade / Reversi** (`src/games/Renegade.tsx`): Added 480ms settling window and input lock to let the 300ms disc-flip scale animations finish before passing the turn.
  - **Gomoku** (`src/games/Gomoku.tsx`): Added 380ms settling delay and input lock so stone placement is cleanly visible.

---

## [1.2.0] - 2026-09-15 — "Visual Overhaul: Clubhouse Tactility, Procedural Animations & Sensory Polish"

### Added — Aesthetic & Animation Engine
- **Procedural Wooden Table Environment** (`src/index.css`, `src/App.tsx`):
  - Engineered an SVG wood grain texture (`.wood-table-bg`) overlaying a warm radial gradient shifting from light `#f3e9dc` at the center to darker `#d8c3a5` along the screen edges.
  - Formatted viewport container with safe-area padding (`pb-safe`, `pt-safe`) locked to portrait orientation.
- **Physical 3D Depth Design Tokens** (`src/index.css`):
  - `.clubhouse-board-depth`: Multi-layered drop shadows simulating physical game board thickness resting on the table.
  - `.clubhouse-piece-shadow`: Physical elevation shadows for game discs, stones, and playing cards.
  - `.clubhouse-inset-recess`: Beveled inner shadows for recessed pits, scoring cups, and board slots.
- **Micro-Interactions & Transient Ripple System** (`src/components/TouchRippleOverlay.tsx`, `src/index.css`):
  - Global touch listener capturing coordinate events to render expanding procedural SVG ripple rings (`animate-ripple`) with light haptic pulses.
  - Elastic button press transitions: press down (`scale-95`) on touch and spring recoil (`scale-105`) with custom `cubic-bezier(0.34, 1.56, 0.64, 1)` easing.
- **Synthesized Audio & Haptic Feedback Suite** (`src/utils/feedback.ts`):
  - `playTapSound()`: High-frequency wood/stone placement clicks with randomized frequency micro-variance.
  - `playCaptureSound()`: Dual-oscillator celebratory chime for captures, extra turns, and completed rows.
  - `playBounceSound()`: Pitch-decaying multi-pop burst simulating chips colliding under gravity.
  - `playErrorBuzz()`: Sawtooth dissonance buzz paired with heavy haptic feedback on illegal plays.
  - `playVictoryFanfare()`: Multi-stage arpeggiated major chord fanfare (C4 - E4 - G4 - C5) on game completion.
- **Sparkle Particle Confetti Overlay** (`src/components/VictoryConfettiOverlay.tsx`, `src/components/GameOverModal.tsx`):
  - 48 procedural animated SVG starbursts and confetti disks bursting outward upon victory with staggered timing.

### Changed — Core Gameplay Polish
- **Mancala Procedural Stone Sowing** (`src/games/Mancala.tsx`, `src/index.css`):
  - Overhauled pit interaction from immediate incrementing to step-by-step sequential sowing.
  - Stones animate along the pit path with bounce keyframes (`.animate-sow-bounce`), pit landing pulse (`.animate-pit-drop`), and synchronized collision clicks at each drop.
  - Applied `.clubhouse-board-depth` and `.clubhouse-inset-recess` to the carved wooden trough and stores.
- **Speed High-Frequency Responsiveness** (`src/games/Speed.tsx`, `src/index.css`):
  - Card placement executes with near-zero lag.
  - Added invalid card play shake animation (`animate-shake` with a red warning ring) and audio buzz (`playErrorBuzz()`) paired with haptic feedback.
- **Connect Four Gravity & Acrylic Styling** (`src/games/ConnectFour.tsx`):
  - Accelerated gravity drop with procedural bounce keyframes on landing.
  - Synchronized `playBounceSound()` with multi-pop chip collisions.
  - Styled translucent vertical rack with plastic highlight gradients, acrylic rim reflections, and depth-shaded colored disks.
- **Tactile Board Styling Upgrades**:
  - `DotsAndBoxes.tsx`: Deep shadow paper grid with spring tactile borders.
  - `Renegade.tsx`: Green felt stadium arena with physical double-sided marble disks and valid move indicators.
  - `YachtDice.tsx`: Beveled dice tray with raised hold states and rolling animations.
  - `MainMenu.tsx`: Applied `.clubhouse-board-depth` to all 12 game selection cards.

### Deployment & Tooling
- Verified `vercel.json` with SPA catch-all rewrites (`/(.*) -> /index.html`).
- Clean production build verified with 0 TypeScript and Vite bundling errors.

---

## [1.1.0] - 2026-09-15 — "Classic Strategy Expansion: Gomoku, Checkers & Backgammon"

### Added
- **Gomoku** (`src/games/Gomoku.tsx`): 15x15 intersection grid with 5-in-a-row detection in all directions and move preview reticles.
- **Checkers / English Draughts** (`src/games/Checkers.tsx`): 8x8 checkerboard with diagonal capture jumps, multi-jump chaining, and king crowning promotions.
- **Backgammon** (`src/games/Backgammon.tsx`): 24-point board with twin dice rolling, checker movement, bar hits, and bearing-off phase logic.

---

## [1.0.0] - 2026-09-15 — "Initial Release: 2-Player Pass-and-Play Classics"

### Added
- Mobile-first React 19 + TypeScript + Tailwind CSS application foundation.
- Full 2-player pass-and-play game engines:
  - **Mancala** (Kalah ruleset, extra turns, pit captures)
  - **Connect Four** (7x6 column drops, 4-in-a-row detection)
  - **Dots and Boxes** (4x4 dot grid, box capture extra turns)
  - **Renegade / Reversi** (8x8 directional flanking and flipping)
  - **Yacht Dice** (5-dice rolling, 12-category scorecard, bonus thresholds)
  - **Speed** (Simultaneous real-time card race, ascending/descending sequencing, stuck vote flips)
  - **Air Hockey** (Split-screen multi-touch canvas physics, mallet-puck collisions, goals)
  - **Toy Tennis** (Retro paddle bouncing with paddle deflection angles)
  - **Carrom** (Tabletop pocket billiards with striker flick physics and carrom men)
- Pass-and-Play Turn Overlay (`TurnTransitionModal.tsx`) with player privacy handoff protection.
- Game Over Modal (`GameOverModal.tsx`) with stat tracking and rematch flow.
- Pure Web Audio API sound synthesis and Vibration API haptic feedback utilities.
