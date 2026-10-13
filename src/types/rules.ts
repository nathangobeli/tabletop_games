import type { GameId } from '../types/game';

export interface GameRule {
  gameId: GameId;
  title: string;
  category: string;
  objective: string;
  setup: string;
  howToPlay: string[];
  winningCondition: string;
  proTip: string;
  proTips?: string[];
}

export const GAME_RULES: Record<GameId, GameRule> = {
  mancala: {
    gameId: 'mancala',
    title: 'Mancala',
    category: 'Ancient Strategy',
    objective: 'Collect the most glass stones in your store (the large scoring cup on your right side) by sowing seeds and capturing opponent pits.',
    setup: 'A traditional wooden Kalah board with 12 small pits (6 on each player\'s side) containing 4 glass stones each (48 stones total), plus 2 large Mancala stores (your store is to your right, opponent\'s store to your left).',
    howToPlay: [
      'Sowing Seeds: Tap any of your 6 pits with stones. All stones are scooped up and sown counter-clockwise, 1 stone per pit, into your pits, your store, and opponent pits (always skipping your opponent\'s store).',
      'Extra Turn Rule (Store Finish): If the very last stone of your move lands in your own Mancala store, you immediately earn an Extra Turn! You can chain multiple extra turns in a row with clever planning.',
      'Capture Rule (Empty Pit Finish): If the very last stone lands in an empty pit on YOUR side, and the opposing pit directly across from it contains opponent stones, you capture that landing stone PLUS all stones from the opposite pit directly into your store!',
      'Turn Hand-off: If your final stone lands in a pit with existing stones (or lands on opponent\'s side without capturing), your turn ends and your opponent moves.',
    ],
    winningCondition: 'When one player clears all 6 of their pits, remaining stones are swept into their owner\'s store. The player with the most total stones (25+) wins!',
    proTip: 'Starting with Pit 6 (6 pits away from store) lands directly in your store for an instant extra turn on move 1.',
    proTips: [
      'Pit 6 Priority: Your 6th pit (rightmost pit) is exactly 6 steps from your store—playing it on turn 1 guarantees a free extra turn every time.',
      'Starvation Defense: Keep pits on your side occupied so you don\'t run out of moves prematurely and hand the opponent free sweeps.',
      'Build Deep Pits: Amass 10+ stones in a single pit to complete a full lap around the board, dropping an extra stone into your store on the way around.',
    ],
  },

  'connect-four': {
    gameId: 'connect-four',
    title: 'Connect Four',
    category: 'Vertical Grid',
    objective: 'Be the first player to form an unbroken horizontal, vertical, or diagonal line of 4 discs in the vertical grid.',
    setup: 'A vertical 7-column by 6-row blue grid (42 slots total). Player 1 drops Cobalt Blue discs, Player 2 drops Crimson Red discs.',
    howToPlay: [
      'Gravity Drop Mechanics: Tap any column arrow (1 to 7) to drop a disc. Discs fall straight down to occupy the lowest unoccupied slot in that column.',
      'Column Capacity: Once a column holds 6 discs, it is full and no more discs can be placed there.',
      'Alternating Turns: Players take turns dropping exactly one disc per turn.',
      'Multi-Directional Vectors: Winning lines can run horizontally across rows, vertically within a column, or diagonally across both 45-degree angles.',
    ],
    winningCondition: 'First player to connect 4 matching discs in a continuous straight row (horizontal, vertical, or diagonal) wins immediately. If all 42 slots are filled with no 4-in-a-row, the game is declared a Draw.',
    proTip: 'Controlling the center column (Column 4) provides the most potential winning vectors across the board.',
    proTips: [
      'Center Column Domination: Column 4 (the center column) can form part of 16 different winning four-in-a-row combinations—more than any other column on the board!',
      'The Double-Ended Trap (The "Seven"): Build horizontal or diagonal rows of 3 discs with open spaces on BOTH ends. Opponent can only block one end, guaranteeing your win on the other!',
      'Avoid Building Ground for Opponent: Never drop a disc into a column if the slot directly ABOVE it would complete an opponent\'s winning line on their next turn.',
    ],
  },

  'dots-and-boxes': {
    gameId: 'dots-and-boxes',
    title: 'Dots and Boxes',
    category: 'Pencil & Paper',
    objective: 'Draw lines between dots to complete and capture more 1x1 square boxes than your opponent.',
    setup: 'A 4x4 grid of brass pins forming a 3x3 array of 9 capturable square boxes.',
    howToPlay: [
      'Drawing Edges: On your turn, tap between any two adjacent horizontal or vertical dots to draw a connecting border line.',
      'Box Completion: The player who draws the 4th and final edge that closes a 1x1 box captures that box. The box is filled with their player color and score increments by 1.',
      'Extra Move Rule: Crucial Rule: Whenever you complete a box, you IMMEDIATELY earn a bonus move!',
      'Chain Captures: If your bonus move completes another box, you earn yet another bonus move! Skilled players can chain 4, 5, or all 9 boxes in a single explosive turn.',
    ],
    winningCondition: 'When all 9 boxes have been completed, the player who captured the majority (5 or more boxes) wins.',
    proTip: 'Avoid drawing the 3rd side of any box unless you can claim the full chain or force an advantageous trade.',
    proTips: [
      'Avoid the 3rd Side Trap: Never draw the 3rd side of any box unless forced, as leaving a 3-sided box gifts your opponent an effortless capture on their turn!',
      'Count Long Chains: In the mid-game, look for corridors where capturing one box unlocks an entire continuous chain of boxes.',
      'Sacrifice & Control: Giving up 2 boxes in a short chain often allows you to take control of a larger 5-box chain elsewhere.',
    ],
  },

  speed: {
    gameId: 'speed',
    title: 'Speed',
    category: 'Rapid Card Game',
    objective: 'Race against your opponent in real-time to empty your entire hand and draw pile before they do.',
    setup: 'A standard 52-card deck split equally. Each player holds 5 cards in hand, has a personal draw pile of 15 cards, plus 2 shared center discard piles.',
    howToPlay: [
      'Real-Time Action: There are NO turns in Speed! Both players play cards simultaneously as fast as their fingers can move.',
      'Playing on Center Piles: Tap a card in your hand, then tap either center discard pile if your card\'s rank is exactly +1 or -1 from the top card (e.g. on a 7, you can play a 6 or an 8).',
      'Continuous Rank Wrap: The sequence wraps around continuously: Aces connect to both 2 and King (A-2-3...Q-K-A). You can play an Ace on a King, or a King on an Ace!',
      'Hand Replenishment: Whenever your hand drops below 5 cards, tap your personal Draw pile to immediately draw back up to 5 cards.',
      'Stalemate Flip: If neither player has any legal moves to play from their hand, tap "Flip New Center Cards" to reset the center table and resume the race.',
    ],
    winningCondition: 'The first player to empty both their hand and their reserve draw pile shouts "SPEED!" and wins the race!',
    proTip: 'Keep both hands ready and watch both center piles—swift reactions to changing top cards are key.',
    proTips: [
      'Watch Both Piles Simultaneously: Don\'t tunnel-vision on just one center pile; scan back and forth to spot double-plays and runs.',
      'Organize Your Hand Mentally: Group cards in your mind into ascending and descending chains (e.g. 4-5-6 or J-10-9) so you can slap down 3 cards in under a second.',
      'Speed Drawing: Keep your thumb resting right near your draw pile so you reload the microsecond a card leaves your hand.',
    ],
  },

  'yacht-dice': {
    gameId: 'yacht-dice',
    title: 'Yacht Dice',
    category: 'Dice & Scoring',
    objective: 'Roll 5 dice and strategically fill all 12 categories on your scorecard to achieve the highest cumulative score.',
    setup: '5 standard six-sided dice, a dice cup, and a 12-category scorecard for each player split into Upper and Lower sections.',
    howToPlay: [
      'The 3-Roll Turn: On your turn, roll all 5 dice. You can roll up to 3 times total per turn.',
      'Holding Dice: After roll 1 or 2, tap any dice in the holding tray to lock them, then roll only the remaining unheld dice to pursue your target combo.',
      'Scoring Categories: After your rolls, tap an available slot on your scorecard. Every slot must be filled once per game; if a roll fails to qualify, you must take a 0 in a chosen category!',
      'Upper Section (Ones to Sixes): Sum of only the matching dice (e.g. three 5s = 15 pts). If your Upper Section total reaches 63 or higher, you score a massive +35 point Upper Bonus!',
      'Lower Section Combos: Choice (Sum all 5), 4 of a Kind (Sum all 5), Full House (25 pts), Small Straight (30 pts), Large Straight (40 pts), and Yacht (5 of a kind -> 50 pts).',
    ],
    winningCondition: 'Once all 12 categories are scored by both players, the player with the highest grand total score wins.',
    proTip: 'Target at least three of each number in the upper section (1s through 6s) to guarantee the 35-point Upper Bonus.',
    proTips: [
      'Aim for the 63 Bonus: Scoring three of each number (three 1s, three 2s... three 6s) equals exactly 63 points, securing the 35-point Upper Bonus.',
      'Sacrifice Low Categories: If you roll a bad hand with no straights or matches, sacrifice your "Ones" category with a 0 or 1 point rather than wasting a high-value lower category.',
      'The Full House Pivot: If you fail to hit 4-of-a-kind on your third roll but have a 3-and-2 split, pivot immediately into Full House for an easy 25 points.',
    ],
  },

  renegade: {
    gameId: 'renegade',
    title: 'Renegade (Reversi)',
    category: 'Classic Reversi',
    objective: 'Finish the game with the majority of discs in your color across the 8x8 green baize grid.',
    setup: 'An 8x8 green board with 4 center discs (2 Dark, 2 Light in alternating diagonal positions).',
    howToPlay: [
      'Flanking & Trapping: Place a disc of your color on an empty square such that it traps one or more continuous opponent discs between your newly placed disc and another existing disc of your color along a straight line (horizontal, vertical, or diagonal).',
      'Flipping Discs: All trapped opponent discs along all flanking vectors flip over to your color immediately!',
      'Mandatory Trap Rule: You can ONLY place a disc on a square that traps and flips at least one opponent disc. If you have no legal flanking moves, your turn is automatically passed.',
      'Board Saturation: The game continues until all 64 squares are filled or neither player can make a legal flanking move.',
    ],
    winningCondition: 'The game ends when the board is full or neither player can make a legal move. The player with the most discs on the board wins.',
    proTip: 'Corners can never be flipped! Prioritize capturing the 4 corner squares and avoid placing discs adjacent to open corners.',
    proTips: [
      'Control the Corners: Corner squares (0,0), (0,7), (7,0), and (7,7) are permanent and cannot be flipped. Securing them anchors entire edges.',
      'Beware C-Squares and X-Squares: Squares directly adjacent to open corners (especially diagonals) allow your opponent to immediately claim the corner on their turn.',
      'Mobility is King: In the opening and mid-game, minimize your disc count and control central territory so your opponent runs out of legal mobility.',
    ],
  },

  'air-hockey': {
    gameId: 'air-hockey',
    title: 'Air Hockey',
    category: 'Tabletop Action',
    objective: 'Score 7 goals into your opponent\'s goal slot while defending your own goal line in a fast-paced air-hockey duel.',
    setup: 'Vertical split-screen rink with center red line. Player 1 controls the bottom mallet; Player 2 controls the top mallet.',
    howToPlay: [
      'Striking the Puck: Touch and drag your mallet to strike the puck. Player 1 is restricted to the bottom half; Player 2 to the top half.',
      'Momentum Transfer: The speed and direction of your finger swipe transfers physical momentum to the puck upon collision.',
      'Wall Bank Shots: Bounce the puck off side walls at sharp angles to bypass the opponent mallet and enter the goal slot.',
      'Desktop Controls: Mouse drag or Arrow Keys for Player 1, WASD for Player 2. Tap or press Space to serve after a goal.',
    ],
    winningCondition: 'First player to reach 7 goals wins the match!',
    proTip: 'Do not chase the puck into corners; hold your ground near your goal slot and strike through the puck as it approaches.',
    proTips: [
      'Hold the Center Pocket: Don\'t chase the puck deep into your side corners. Guard the center pocket 2 inches in front of your goal slot and strike through the puck as it rebounds toward you.',
      'The Cross-Court Bank: Strike the puck against the side rail just before the center line to send a blistering angled bank shot into the far corner of the opponent goal.',
      'Avoid Soft Bumps: Never let the puck rest stationary near your mallet; strike decisively so the opponent has less time to react.',
    ],
  },

  'toy-tennis': {
    gameId: 'toy-tennis',
    title: 'Toy Tennis',
    category: 'Retro Arcade',
    objective: 'Rally the ball back and forth across the net and score 5 points to win the arcade tennis duel.',
    setup: 'Top-down arcade court with a center net. Player 1 defends bottom baseline; Player 2 defends top baseline.',
    howToPlay: [
      'Paddle Positioning: Slide your paddle along the baseline to intercept and return the incoming ball.',
      '3D Altitude & Bounce: The ball has 3D altitude (z-axis) and bounces realistically off the court surface.',
      'Net Clearance: Returns must clear the center net height without clipping the net tape.',
      'Sweet Spot Strikes: Hitting near the paddle center provides a sweet-spot upward arc and increased return speed. Edge hits produce sharp cross-court slices.',
      'Desktop Controls: Left/Right arrow keys for Player 1, A/D keys for Player 2.',
    ],
    winningCondition: 'A point is scored when your opponent fails to return the ball or hits the net. First to 5 points wins!',
    proTip: 'Strike the ball early on its upward bounce to send a fast, angled shot across the court.',
    proTips: [
      'Strike on the Rise: Hit the ball early right as it bounces upward from the court to send a lightning-fast return before the opponent can reposition.',
      'Work the Angles: Alternate hitting shots toward opposite corners of the baseline to force your opponent into desperate lateral recovery sprints.',
      'Net Defense: Stay centered between rallies so you have equal reach to both left and right baseline corners.',
    ],
  },

  carrom: {
    gameId: 'carrom',
    title: 'Carrom',
    category: 'Strike & Pocket',
    objective: 'Pocket all of your assigned carrom men (White for P1, Black for P2) plus the high-value Red Queen.',
    setup: 'Square wooden board with 4 corner pockets. Carrom men arranged in a central ring around the Queen.',
    howToPlay: [
      'Striker Placement: Position your large striker along your baseline touching both baseline boundary lines.',
      'Aim & Strike: Drag backward from the striker to set shot power and aim vector; release to strike.',
      'Piece Values: White pieces = 10 pts (P1 target), Black pieces = 10 pts (P2 target), Red Queen = 25 pts.',
      'Covering the Queen: Pocketing the Queen requires "covering": you must pocket one of your own pieces on the same or subsequent shot to claim her points.',
      'Striker Fouls: Pocketing the striker is a foul. A penalty piece is returned to the center, and your turn ends.',
    ],
    winningCondition: 'The game ends when all pieces of one color are pocketed. The player with the most points wins.',
    proTip: 'Use smooth bank shots off the outer wooden edges to pocket pieces tucked behind obstacles.',
    proTips: [
      'Bank Shots & Rebounds: Carrom pieces reflect off wooden borders at equal angles of incidence and reflection. Use side cushion rebounds to pocket pieces obstructed by opponent men.',
      'Cluster Breaking: On early turns, strike the central cluster with moderate power to scatter pieces toward your corner pockets without leaving easy tap-ins for your opponent.',
      'Queen Timing: Do not pocket the Queen unless you have an easy, high-percentage shot on one of your own pieces lined up to guarantee the cover!',
    ],
  },

  gomoku: {
    gameId: 'gomoku',
    title: 'Gomoku',
    category: 'Five in a Row',
    objective: 'Form an unbroken horizontal, vertical, or diagonal row of exactly 5 stones on the 15x15 intersection grid.',
    setup: 'A 15x15 wooden intersection grid. Player 1 plays Black stones; Player 2 plays White stones.',
    howToPlay: [
      'Intersection Placement: Players alternate turns placing one stone on an unoccupied grid intersection.',
      'Permanent Placement: Stones cannot be moved or captured once placed.',
      'Open Threes & Fours: An open three (3 stones with open ends) becomes an open four if unblocked. An open four cannot be defended because the opponent can only block one end!',
      'Double Threats: The key to victory is building intersecting attack lines (e.g. 3-and-3 or 4-and-3) that force simultaneous threats.',
    ],
    winningCondition: 'The first player to align 5 or more consecutive stones horizontally, vertically, or diagonally wins immediately.',
    proTip: 'Create double-threat formations (like a 3-and-3 or 4-and-3 intersection) that leave your opponent unable to defend both attack vectors.',
    proTips: [
      'Build Fork Formations: Create a "V" or "X" shape where two separate lines of 3 share a common intersection point. When you complete the 4th stone on one line, you create an unstoppable win on the other.',
      'Block Open Threes Immediately: Never ignore an opponent\'s line of 3 stones open on both ends. Block it immediately before it promotes to an Open Four!',
      'Center Opening: Black\'s first stone should always be placed at or near the center intersection (Tengen) for maximum directional reach across all 8 vectors.',
    ],
  },

  checkers: {
    gameId: 'checkers',
    title: 'Checkers (Draughts)',
    category: 'Draughts Strategy',
    objective: 'Capture all of your opponent\'s checkers or completely block them so they have no legal moves remaining.',
    setup: '8x8 board with 12 pieces per player placed on the dark squares of the first 3 rows.',
    howToPlay: [
      'Diagonal Steps: Regular pieces move diagonally forward 1 square onto an open dark square.',
      'Jump Captures: If an opponent piece is diagonally adjacent forward and the square immediately beyond is empty, you must jump over it, removing it from play.',
      'Multi-Jumps: If another jump is immediately available from the landing square, you must continue jumping in the same turn.',
      'Mandatory Jumping: If any jump is available on your turn, you are required to capture. Normal non-capturing moves are disallowed when a jump exists.',
      'King Promotion: Reaching the opponent back row crowns your piece as a King. Kings can move and jump both forward and backward!',
    ],
    winningCondition: 'Capture all opponent pieces or block them so they have no legal moves remaining.',
    proTip: 'Advance your back row cautiously; keeping your rear guard intact prevents opponent pieces from easily promoting to Kings.',
    proTips: [
      'Guard Your Back Row: Keep your 4 back-row checkers in place as long as possible. A solid back wall makes it impossible for opponent pieces to sneak through and promote to Kings.',
      'Control the Center Diamonds: Checkers positioned on the edge columns can only move in 1 direction. Checkers in the center control 2 diagonal directions and dictate the board tempo.',
      'Forced Sacrifices: Exploit the mandatory jump rule: sacrifice 1 checker to force your opponent into an awkward jump that opens up a 2-for-1 or 3-for-1 multi-jump counter-strike!',
    ],
  },

  backgammon: {
    gameId: 'backgammon',
    title: 'Backgammon',
    category: 'Points & Tables',
    objective: 'Move all 15 of your checkers into your Home Board and bear them off the table before your opponent.',
    setup: '24 triangular points. Player 1 moves counter-clockwise from point 24 down to 1 (Home: 1-6). Player 2 moves clockwise from point 1 up to 24 (Home: 19-24).',
    howToPlay: [
      'Dice Rolls: Roll 2 dice at the start of your turn. You can move one checker by the sum of both dice, or move two checkers by each rolled value.',
      'Doubles Bonus: Rolling doubles (e.g. 4-4) lets you play the rolled number 4 times!',
      'Open Points: You can land on any point with fewer than 2 opponent checkers. You cannot land on a point with 2 or more opponent checkers (blocked point).',
      'Hitting a Blot: Landing on a point with a single solitary opponent checker ("blot") sends it to the central Bar.',
      'Re-entry from the Bar: Checkers on the Bar must re-enter into the opponent furthest home quadrant before any other checkers can move.',
      'Bearing Off: Once all 15 of your checkers are inside your 6-point Home Board, you can begin rolling dice to remove them from the board.',
    ],
    winningCondition: 'The first player to bear off all 15 checkers wins the match. Bearing off before opponent bears any off scores a Gammon (double win); before opponent leaves the bar scores a Backgammon (triple win)!',
    proTip: 'Do not leave lone single checkers ("blots") within direct roll distance (1-6 points) of opponent pieces.',
    proTips: [
      'Anchor Prime Blocks: Build a "prime" (a continuous wall of 4 to 6 consecutive blocked points holding 2+ checkers each). An opponent checker cannot jump over a 6-point prime under any circumstances!',
      'Avoid Blots in Direct Range: A lone blot located 1 to 6 points ahead of an opponent piece is in grave danger of being hit. Pair checkers together to make points safe.',
      'Run with Your Back Runners: Prioritize advancing your 2 deep checkers on point 24 out into the middle board before the opponent builds a wall around them.',
    ],
  },

  billiards: {
    gameId: 'billiards',
    title: 'Billiards (8-Ball)',
    category: 'Cue Sports',
    objective: 'Pot all 7 of your assigned balls (Solids 1–7 or Stripes 9–15) and then legally pocket the 8-Ball to win.',
    setup: 'A regulation baize slate table with 6 drop pockets. 15 numbered object balls racked in a triangle plus the white cue ball.',
    howToPlay: [
      'Open Table: The table remains open until the first numbered ball is legally potted, assigning that group (Solids or Stripes) to the shooter.',
      'Aim & Strike: Drag anywhere to orient the cue stick with ghost trajectory preview. Pull back the power slider to strike the cue ball.',
      'Turn Continuation: Potting any ball of your assigned group allows you to continue shooting. Failing to pot passes the turn to your opponent.',
      'Scratch / Foul: Pocketing the cue ball gives the opponent Ball-in-Hand (the freedom to drag and place the cue ball anywhere on the table).',
      'The 8-Ball: Once you have pocketed all balls in your group, call and pocket the black 8-ball to win.',
    ],
    winningCondition: 'Legally pocketing the 8-ball after your group is cleared wins. Pocketing the 8-ball prematurely or scratching while pocketing the 8-ball results in an immediate loss.',
    proTip: 'Plan position play on every shot—consider where the cue ball will stop after striking your target ball.',
    proTips: [
      'Cue Ball Position Play: Never shoot just to pocket a ball; always plan where the cue ball will roll and stop after the collision so you have an easy shot on your next ball.',
      'Solve Problem Clusters Early: Identify blocked or clustered balls early in the rack and use breakout shots to open them up while you still have plenty of open balls on the table.',
      'Bank Shots & English: Use rails for bank shots when direct pocket lines are obstructed by opponent balls.',
    ],
  },

  darts: {
    gameId: 'darts',
    title: 'Darts',
    category: 'Pub Precision',
    objective: 'Throw 3 darts per turn at the bristle sisal board to reduce your score to exactly 0 (501) or close target numbers (Cricket).',
    setup: 'A standard 20-segment sisal dartboard featuring inner triple rings (3x), outer double rings (2x), and a center bullseye (25 / 50 pts).',
    howToPlay: [
      '501 Countdown: Both players start at 501. Each dart subtracts from your total. First to reach exactly 0 wins! Going below 0 is a Bust (turn score discarded).',
      'Cricket Mode: Players race to close numbers 15 through 20 and the Bullseye by landing 3 marks on each. Closed numbers score points until the opponent closes them.',
      'Throw Mechanics: Touch and swipe upward toward your target. Your swipe release velocity and release angle determine dart flight and arc.',
      'Turn Flow: Each player throws 3 darts. Darts stay pinned in the board until round completion for tactile pass-and-play.',
    ],
    winningCondition: 'In 501: First to reach exactly 0. In Cricket: First to close all 7 target sectors with a score equal to or higher than the opponent.',
    proTip: 'Smooth, consistent upward swipes produce much tighter groupings than erratic, flicked gestures.',
    proTips: [
      'Triple 20 is the Highest Score: The Triple 20 sector awards 60 points per dart—higher than the 50-point Bullseye! Three darts in Triple 20 scores the maximum 180 ("Ton-80").',
      'Smooth Swipe Rhythm: A smooth, straight upward swipe produces far tighter grouping than rapid, jerky flicks.',
      'Setup for Double 16 / Double 20: In 501, leave yourself an even checkout score like 32 (Double 16) or 40 (Double 20), because missing into single 16 leaves 16 (Double 8), keeping you in the game!',
    ],
  },

  bowling: {
    gameId: 'bowling',
    title: 'Bowling',
    category: 'Alley Sports',
    objective: 'Knock down as many pins as possible across 10 frames to achieve the highest cumulative score.',
    setup: 'A polished maple lane with target chevrons, gutters, and 10 weighted pins arranged in the classic triangle formation.',
    howToPlay: [
      'Positioning: Slide left or right on the approach line to align your starting angle.',
      'Delivery & Hook: Swipe forward to roll the ball. A curved swipe imparts spin/hook onto the ball as it rolls down the lane.',
      'Frames 1–9: Two rolls per frame. Knocking all 10 pins on roll 1 is a Strike (X). Knocking remaining pins on roll 2 is a Spare (/).',
      'Frame 10: Earning a Strike or Spare in the final 10th frame awards bonus rolls (up to 3 total rolls).',
      'Scoring: Strikes award 10 plus the next 2 rolls; Spares award 10 plus the next 1 roll.',
    ],
    winningCondition: 'Player with the highest total score after all 10 frames wins the match (maximum possible score: 300).',
    proTip: 'Aim for the 1–3 pocket with a 2.5° to 4.5° hook angle to generate the kinetic chain reaction needed to trip corner pins 7 and 10.',
    proTips: [
      'Pocket Entry Window: A strike requires a precise hit into the 1–3 pocket (right-handed, X between 14px and 22px) or 1–2 pocket (left-handed, X between -22px and -14px).',
      'Approach Angle: Ensure your roll hits at an angle between 2.5° and 4.5°. Flat, zero-degree entries will fail to deflect pins into the stubborn 7 or 10 corner pins.',
      'Beware the Headpin Chop: Dead-center rolls (|X| < 8px) punch straight through pins 1, 5, 8, and 9, deflecting wings outward and leaving the dreaded 7–10 split!',
    ],
  },

  'mini-shogi': {
    gameId: 'mini-shogi',
    title: 'Mini Shogi (5x5)',
    category: 'Japanese Chess',
    objective: 'Checkmate or capture the opponent King on a compact 5x5 board using strategic piece drops and promotions.',
    setup: 'A 5x5 wooden board. Each player commands King, Gold, Silver, Bishop, Rook, and Pawn, with side trays (komadai) for captured reserves.',
    howToPlay: [
      'Piece Movement: King moves 1 square in all 8 directions; Gold moves 1 square orthogonally or diagonally forward; Silver moves 1 square forward or in all 4 diagonals.',
      'Rook & Bishop: Bishop moves any distance diagonally; Rook moves any distance orthogonally; Pawn moves 1 square straight forward.',
      'The Drop Rule (Uchi): Captured opponent pieces enter your reserve tray. On your turn, you may drop a reserve piece onto any vacant square instead of moving a board piece.',
      'Promotion: Reaching the opponent back rank (Rank 5 for P1, Rank 1 for P2) lets Pawn, Silver, Bishop, and Rook promote to powerful forms (Tokin, Narigin, Horse, Dragon).',
      'Illegal Drops: Dropping a Pawn to create an immediate checkmate (Uchifuzume) or dropping two unpromoted Pawns in the same column (Nifu) is illegal.',
    ],
    winningCondition: 'Checkmate the opponent King so it cannot escape capture.',
    proTip: 'Dropped pieces retain their captured orientation and can be placed behind enemy lines for surprise tactical strikes.',
    proTips: [
      'Drops Behind Enemy Lines: Dropping a captured piece into the opponent\'s rear territory is the fastest way to launch an unexpected fork against their King and Rook.',
      'Promoted Rook (Dragon) is Lethal: A Promoted Rook controls the entire 5x5 board; getting your Rook promoted on turn 2 or 3 guarantees immense tactical pressure.',
      'Keep Defensive Reserves: Don\'t spend all captured pieces on reckless attacks—keep a Silver or Gold in reserve to drop as an emergency shield when your King is checked.',
    ],
  },

  'toy-curling': {
    gameId: 'toy-curling',
    title: 'Toy Curling',
    category: 'Ice & Precision',
    objective: 'Slide granite curling stones down the pebble-ice sheet to rest closer to the center button than your opponent.',
    setup: 'A top-down ice sheet ending in concentric rings ("the house") with a central button. Each player throws 4 stones per end.',
    howToPlay: [
      'Aim & Delivery: Set your aim angle, choose curl direction (In-Turn, Straight, Out-Turn) with adjustable curl spin (Gentle, Medium, Sharp), and tune delivery weight (Guard, Draw, Takeout).',
      'Curl Dynamics: As stones decelerate, lateral torque causes them to curve toward the target. Adjust curl strength or choose straight for direct hits.',
      'Sweeping: Quickly swipe horizontally across the ice ahead of a gliding stone to melt pebble frost, reducing friction and straightening the path.',
      'Collisions: Knock opponent stones out of the scoring house or bump friendly guards into the button.',
      'End Scoring: At the end of all 8 stones, the player with the stone closest to the button scores 1 point for each stone closer than the opponent\'s nearest stone.',
    ],
    winningCondition: 'Player with the highest cumulative points after the match ends wins.',
    proTip: 'Place guard stones in front of the house early, then curl your scoring stones safely behind them.',
    proTips: [
      'Guard the Front Porch: Throwing a stone that stops just outside the house creates a protective wall. You can then curl your second stone safely behind it.',
      'Hold the Hammer (Last Stone): The team throwing the final stone of the end has the "Hammer" and holds a massive advantage to score the winning takeout or draw.',
      'Sweeping Precision: Don\'t sweep continuously; let the stone curl into position and sweep only when you need extra glide distance.',
    ],
  },

  hex: {
    gameId: 'hex',
    title: 'Hex',
    category: 'Connection Strategy',
    objective: 'Create an unbroken connected chain of friendly gems connecting your two opposing board borders.',
    setup: 'An 11x11 diamond rhombic board of hexagonal cells. Player 1 connects Cobalt Blue (top-left to bottom-right); Player 2 connects Crimson Red (top-right to bottom-left).',
    howToPlay: [
      'Placing Gems: Players alternate tapping any vacant hexagonal recess to place a colored acrylic gem.',
      'Hexagon Connectivity: Hex gems connect through any of their 6 adjacent neighboring hexes.',
      'Border Connections: Borders count as connected if a friendly gem occupies any hex along that perimeter.',
      'No Captures / No Draws: Gems remain in place for the entire match. It is mathematically proven that Hex CANNOT end in a draw!',
    ],
    winningCondition: 'The first player to form an unbroken path connecting their two opposite board sides wins immediately.',
    proTip: 'Use "virtual connections" (two shared neighbor bridge cells) to guarantee links even if your opponent tries to block.',
    proTips: [
      'The Virtual Connection (2-Bridge): Two gems separated by two mutually shared empty neighbors are "virtually connected"—if your opponent plays in one empty cell, you simply play in the other!',
      'Control the Board Center Early: A gem in the center of the 11x11 board can branch outward in 4 directions, applying simultaneous pressure toward both target borders.',
      'Watch Border Defense: Intercept opponent bridge leaps when they approach within 2 rows of their target rail.',
    ],
  },

  matching: {
    gameId: 'matching',
    title: 'Matching (Memory)',
    category: 'Memory & Focus',
    objective: 'Flip cards and find the most matching pairs of tabletop icons across the baize grid.',
    setup: 'A 6x4 grid of 24 linen-embossed cards containing 12 unique matching pairs of procedural tabletop game artifacts.',
    howToPlay: [
      'Card Flip Turn: On your turn, tap card 1 to reveal its hidden icon, then tap card 2.',
      'Match Found: If the two cards match, you keep the pair face-up, score 1 point, and earn an IMMEDIATE BONUS TURN!',
      'Missed Match: If the cards do not match, both cards flip back face-down after a brief glance, and the turn passes to your opponent.',
      'Concentration: Memorize the locations of cards flipped by your opponent during their turns so you can claim pairs on your turn.',
    ],
    winningCondition: 'When all 12 pairs have been matched, the player with the most collected pairs wins.',
    proTip: 'Pay close attention to cards flipped over on your opponent\'s turn to remember their grid coordinates.',
    proTips: [
      'Mental Spatial Grid: Assign mental coordinates (e.g. Row 2, Col 3) to cards as they are flipped so you don\'t confuse neighboring cards.',
      'Avoid Unnecessary Reveals: If you know the location of only one half of a pair, don\'t flip a random card first—flip the unknown card first! If it happens to be the match, you already know where the second card is.',
      'Chain Bonus Streaks: Finding a pair grants an extra turn; chaining 3 or 4 pairs in a single turn will completely blow out the match.',
    ],
  },

  'nine-mens-morris': {
    gameId: 'nine-mens-morris',
    title: "Nine Men's Morris",
    category: 'Ancient Strategy',
    objective: 'Form horizontal or vertical lines of 3 pieces (mills) to capture opponent pieces and immobilize their army.',
    setup: 'A 24-point board of 3 concentric squares joined by crossbars. Each player commands 9 turned-wood pieces.',
    howToPlay: [
      'Phase 1 (Placement): Players alternate placing their 9 reserve pieces onto vacant intersection points.',
      'Phase 2 (Movement): Players slide one piece per turn along connecting lines to an adjacent empty point.',
      'Phase 3 (Flying): When a player is reduced to exactly 3 pieces, their pieces can fly (jump) to ANY vacant point on the board!',
      'Mill Rule: Lining up 3 friendly pieces in a straight line forms a Mill. You may remove one opponent piece (pieces in active opponent mills are protected unless no other pieces exist).',
    ],
    winningCondition: 'Reduce your opponent to fewer than 3 pieces or leave them with zero legal moves on their turn.',
    proTip: 'Build a "double mill" where moving a single piece back and forth closes a mill on every single turn.',
    proTips: [
      'The Double Mill Engine: The most lethal formation is a "Double Mill"—two 3-in-a-row lines that share a single pivot piece. Moving that pivot piece back and forth closes a mill and captures an opponent piece on EVERY SINGLE TURN!',
      'Block Opponent Mills in Phase 1: During placement, prioritize blocking opponent lines of 2 rather than mindlessly placing pieces in corners.',
      'Control the Midpoint Crossbars: Intersections on the middle square connect in 4 directions, providing maximum mobility and mill formation speed.',
    ],
  },

  'hare-and-hounds': {
    gameId: 'hare-and-hounds',
    title: 'Hare and Hounds',
    category: 'Asymmetric Pursuit',
    objective: 'Hounds try to trap the agile Hare, while the Hare attempts to escape past the hound line or outlast them.',
    setup: 'An 11-node stone slab track. Player 1 controls 3 bronze Hounds starting on the left; Player 2 controls 1 copper Hare on the right.',
    howToPlay: [
      'Hounds Movement (P1): Can move one step forward or vertically along connected edges. Hounds CANNOT retreat backward!',
      'Hare Movement (P2): Can move one step in ANY direction (forward, backward, or vertical) along connected edges.',
      'Alternating Turns: Only one token moves per turn, alternating between Hounds and Hare.',
      'Stalling Limit: If the Hounds fail to make forward progress for 10 consecutive turns, the game is awarded to the Hare to prevent stalling.',
    ],
    winningCondition: 'Hounds win if they trap the Hare so it has no legal moves. Hare wins if it bypasses the hounds (reaches a column to the left of all 3 hounds) or if 10 consecutive moves pass without hounds advancing.',
    proTip: 'Hounds must advance as a coordinated vertical wall to prevent the Hare from slipping through gaps.',
    proTips: [
      'Hounds Must Advance as a Wall: Hounds should never send one piece charging forward alone. Advance all 3 hounds together in a vertical column to seal off all escape corridors.',
      'Hare Center Node Defense: As the Hare, stay in the central node as long as possible. Moving to top or bottom perimeter nodes limits your escape paths to only 2 or 3 connections.',
      'The Backward Feint: When the Hounds commit two pieces forward, use the Hare\'s unique backward-step ability to slip behind their advance line.',
    ],
  },

  'hit-and-blow': {
    gameId: 'hit-and-blow',
    title: 'Hit and Blow',
    category: 'Code Deduction',
    objective: 'Deduce the secret 4-color code combination through tactical color placement and deductive logic feedback within 10 guesses.',
    setup: 'A 10-row wooden peg console with 6 vibrant peg colors (Red, Blue, Green, Yellow, Orange, Purple) and a secret 4-peg code.',
    howToPlay: [
      'Placing a Guess: Select 4 colored pegs to place in the current guess row, then tap Submit.',
      'Hit (Black Peg): A peg matches both the correct color AND the exact socket position.',
      'Blow (White Peg): A peg matches the correct color, but is in the wrong position.',
      'Deduction Logic: Clue positions do NOT match socket positions! Use clues from earlier rows to systematically eliminate impossible colors.',
    ],
    winningCondition: 'Crack the code by scoring 4 Hits within 10 guesses to win!',
    proTip: 'Test distinct colors on your first two rows to quickly isolate which colors are present in the secret code.',
    proTips: [
      'The Two-Color Probe: On Guess 1, try two pairs of colors (e.g. Red-Red-Blue-Blue). If you receive 0 feedback pegs, you immediately eliminate 2 colors out of 6!',
      'Position Swapping: If you get 2 Blows and 0 Hits with 4 distinct colors, you know all 4 colors are in the code—you only need to swap their positions!',
      'Logically Verify Every Guess: Never submit a guess that contradicts feedback from previous rows. Every row should narrow the mathematical problem space.',
    ],
  },

  hanafuda: {
    gameId: 'hanafuda',
    title: 'Hanafuda (Koi-Koi)',
    category: 'Traditional Japanese',
    objective: 'Capture cards by matching floral suits to form high-scoring combinations (Yaku) and decide when to cash out or call Koi-Koi.',
    setup: '48 floral cards across 12 months. 8 cards dealt to each player, 8 to the central field, and 24 in the draw deck.',
    howToPlay: [
      'Hand Match: Play a card from hand. If its flower suit matches a card on the field, you capture both into your scoring tray. If no match, your card stays on the field.',
      'Deck Draw: Flip the top card of the draw deck. If it matches a field card, capture both into your tray; otherwise, place it on the field.',
      'Form Yaku: Captured cards build Yaku: Brights (Crane, Moon, Curtain, Rainman, Phoenix), Animals (Boar-Deer-Butterfly), Ribbons (Poetry & Blue), and Chaff (Kasu).',
      'Push-Your-Luck: When you complete a Yaku, decide whether to STOP (claim your points and win round) or call KOI-KOI (continue to hunt for more points, risking your opponent finishing first).',
    ],
    winningCondition: 'If you call STOP with an active Yaku, you bank that score. If your opponent scores after your Koi-Koi, they win and you get 0 points!',
    proTip: 'The Chrysanthemum Sake Cup is the most versatile card: it counts as an Animal AND forms the 5-point Moon-Viewing and Cherry-Viewing combinations.',
    proTips: [
      'The Sake Cup is Golden: The Chrysanthemum Sake Cup is the most powerful card in the deck—it counts as an Animal card AND forms the 5-point Moon-Viewing (Tsukimi-de-Ippai) and Cherry-Viewing (Hanami-de-Ippai) combos!',
      'Target Brights Early: Secure the March Curtain and August Moon early in the round; they provide quick avenues to 5-point viewing combos.',
      'When to Call Koi-Koi: Only call Koi-Koi if your opponent has very few captured cards and cannot complete a fast Ribbon or Chaff Yaku before your next turn.',
    ],
  },

  president: {
    gameId: 'president',
    title: 'President (Daifugo)',
    category: 'Card Climbing Duel',
    objective: 'Be the first player to shed all cards from your hand by playing increasingly higher card combinations.',
    setup: 'Standard 54-card deck (including 2 Jokers). Each player receives 18 cards sorted from 3 (lowest) to 2 (highest), with Jokers as wild / highest.',
    howToPlay: [
      'Card Hierarchy: Card power runs strictly 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < Joker.',
      'Matching Quantities: The lead player plays any valid single, pair, triple, or 4-of-a-kind. The opponent must play a combination of the EXACT same quantity with a higher rank, or choose to pass.',
      'Passing & Clearing: Passing does not eliminate you; when neither player can beat the pile, the stack clears and the last player to play leads a fresh combination.',
      '8-End (Hachi-Giri): Any play containing an 8 immediately clears the discard pile and grants you the lead!',
      'Revolution (Kakumei): Playing a 4-of-a-kind reverses rank hierarchy for the rest of the round: 3 becomes highest, 2 becomes lowest!',
    ],
    winningCondition: 'The first player to empty their hand wins the round and claims the title of President!',
    proTip: 'Save an 8 or a 2 to seize control of the board when your opponent is holding a low card count.',
    proTips: [
      'Save an 8 for Emergency Control: An 8 is your ultimate panic button. Drop it to instantly clear the pile when your opponent tries to lock you out.',
      'Lead with Low Multiples: Lead pairs or triples of low cards (like pairs of 4s or 5s) early to bleed out junk cards without giving up your single power cards (2s and Aces).',
      'Plan for Revolution: If you hold four 4s or four 5s, hold onto your remaining 3s! Trigger the Revolution and your low cards immediately become unstoppable powerhouses.',
    ],
  },

  'last-card': {
    gameId: 'last-card',
    title: 'Last Card',
    category: 'Action Card Shedding',
    objective: 'Shed all cards from your hand by matching the top card of the discard pile by Rank or Suit.',
    setup: 'Each player receives 7 cards. One card is flipped face-up to begin the center discard pile.',
    howToPlay: [
      'Matching Rank or Suit: On your turn, play a card that matches the active discard pile in either Suit or Rank. If you have no legal card, tap Draw.',
      '2s (Draw Two): Forces opponent to draw 2 cards. If the opponent counters with another 2, the penalty stacks (+4, +6)!',
      'Aces (Play Again): Grants the player an immediate extra turn.',
      'Jacks (Skip): In 2-player mode, skips the opponent and returns turn to you.',
      '8s (Wild Card): Can be played on any card; opens a picker to declare a new active suit.',
      'Last Card Callout: When playing down to your final card, tap "CALL LAST CARD" before discarding! Failing to call it incurs a 2-card penalty draw.',
    ],
    winningCondition: 'First player to play their final card wins the match!',
    proTip: 'Save wild 8s for late-game disruption or to switch suits when an opponent is down to their final card.',
    proTips: [
      'Save Wild 8s: Avoid burning your wild 8 early on. Keeping an 8 in reserve gives you a guaranteed escape hatch when an opponent tries to pin you with an off-suit card.',
      'Stack the 2s: Never throw your only "2" blindly. Save it to counter your opponent’s "2" and pass a +4 draw penalty back across the table.',
      'Last Card Discipline: Always tap "Call Last Card" before dropping your penultimate card—forgetting gives your opponent free card advantage.',
    ],
  },

  'riichi-mahjong': {
    gameId: 'riichi-mahjong',
    title: 'Riichi Mahjong',
    category: 'Tile Strategy Duel',
    objective: 'Build a winning 14-tile hand composed of 4 sets (melds) and 1 pair with at least 1 valid Yaku.',
    setup: 'Fast 2-player Sanma set (108 tiles): Pinzu (Dots), Souzu (Bamboo), 1 & 9 Manzu terminals, Winds (East, South, West, North), and Dragons (White, Green, Red). 13 tiles dealt each.',
    howToPlay: [
      'Tile Turn Flow: Draw a tile on your turn to reach 14 tiles, evaluate melds (triplets or sequences), and discard one unwanted tile into your river (kawa).',
      'Hand Structure: A complete hand consists of 4 sets (3 tiles each) + 1 pair (2 identical tiles) = 14 tiles total.',
      'Call Pon: Call opponent discard to complete a triplet (3 identical tiles).',
      'Declare Riichi: When 1 tile away from winning (Tenpai) on a closed hand, tap Riichi, deposit a 1,000-pt tenbo stick, and enter auto-draw mode.',
      'Win with Ron or Tsumo: Call Ron when opponent discards your winning tile, or call Tsumo when you draw it yourself.',
      'Valid Yaku Required: Hand must have at least 1 Yaku (Riichi, Tanyao/All Simples, Dragons/Winds, Honitsu/Half Flush, Toitoi/All Triplets, or Seven Pairs).',
    ],
    winningCondition: 'First player to complete a valid Yaku hand wins the round payout (Mangan 8,000, Haneman 12,000) or bankrupts the opponent!',
    proTip: 'Tanyao (All Simples) is the easiest and fastest hand: discard all 1s, 9s, and Honor tiles, and build entirely with numbers 2 through 8.',
    proTips: [
      'Master Tanyao (All Simples): Tanyao is the fastest and easiest beginner Yaku: discard all 1s, 9s, Winds, and Dragons, and build your hand entirely with number tiles 2 through 8.',
      'Honor Tiles Give Easy Yaku: A triplet of White, Green, or Red Dragons (or your seat wind) immediately satisfies the 1-Yaku requirement, allowing you to open your hand with Pon calls without fear!',
      'Beware Furiten: If any tile you have previously discarded in your river could complete your current hand, you are in Furiten—you can NEVER call Ron on an opponent\'s discard and can only win by drawing the tile yourself via Tsumo!',
    ],
  },

  battleship: {
    gameId: 'battleship',
    title: 'Battleship',
    category: 'Naval Tactical Combat',
    objective: 'Locate and sink all five vessels of the enemy fleet before they sink yours.',
    setup: 'Each admiral commands 5 naval vessels: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), and Destroyer (2), secretly deployed across a 10x10 Ocean grid.',
    howToPlay: [
      'Fleet Deployment: Secretly deploy your 5 ships horizontally or vertically on your ocean grid. Ships cannot overlap or touch edge borders improperly.',
      'Target Acquisition: On your turn, select an uninspected coordinate on the Radar Targeting Grid and fire a salvo.',
      'Salvo Report: Your shot results in either a "Hit" (red explosion peg) or a "Miss" (black splash peg).',
      'Vessel Sunk: When all segments of an enemy ship are hit, that ship is sunk and eliminated from combat.',
      'Alternating Fire: Admirals alternate firing 1 salvo per turn.',
    ],
    winningCondition: 'The first admiral to score 17 direct hits and sink all 5 enemy ships wins the naval campaign!',
    proTip: 'Use a checkerboard parity hunting pattern: because the smallest ship is 2 squares long, scanning every other coordinate guarantees you will not miss any vessel while cutting search time in half.',
    proTips: [
      'Parity Scanning: Fire in diagonal checkerboard lines. Since the smallest ship (Destroyer) occupies 2 cells, it is mathematically impossible for any ship to hide without crossing your parity grid.',
      'Target & Destroy: Once you score a "Hit", immediately probe the 4 orthogonal adjacent cells (North, South, East, West). Once a second hit confirms the ship alignment, walk the line in both directions until the ship sinks.',
      'Edge & Island Spacing: Avoid clustering all your ships together in the corners. Smartly distribute vessels with water gaps so lucky exploratory hits cannot cascade into neighboring ships.',
    ],
  },

  cribbage: {
    gameId: 'cribbage',
    title: 'Cribbage',
    category: 'Classic 121-Point Card & Peg Game',
    objective: 'Be the first player to peg 121 points on the carved wooden cribbage board. Score points by discarding strategically to the Crib, pegging cards up to a running total of 31 during play, and scoring 5-card combinations (15s, pairs, runs, flushes, nobs) during The Show.',
    setup: 'A continuous 120-hole wooden track with dual leapfrog pegs (Brass for P1, Steel for P2). Standard 52-card deck where Aces = 1 point, face cards (K, Q, J) = 10 points, and number cards 2–10 = face value. In each round, both players receive 6 cards and must discard 2 into the Dealer\'s secret Crib.',
    howToPlay: [
      'Card Values & Hierarchy: Aces are ALWAYS low and count as 1 point. Face cards (Kings, Queens, Jacks) count as 10 points each. Number cards (2 through 10) count as their face value. For consecutive runs, the rank hierarchy is strictly A-2-3-4-5-6-7-8-9-10-J-Q-K (Aces never connect with Kings).',
      'The Deal & The Crib (Discard Phase): Each round begins with 6 cards dealt to each player. Both players secretly select 2 cards to toss into the "Crib" (leaving 4 cards in each hand). The Crib belongs entirely to the Dealer as a bonus hand counted at the end of the round. When you are the Dealer, feed your crib with high-scoring synergies (5s, pairs, connectors like 7-8). When your opponent is Dealer, "balk" their crib by discarding safe, unconnected cards (like King and 2).',
      'The Starter Cut ("Two for His Heels"): After discards are placed into the Crib, the deck is cut to reveal a face-up Starter Cut Card. If the cut card is a Jack, the Dealer immediately yells "Two for his heels!" and pegs +2 points on the board before card play begins.',
      'The Pegging Phase ("The Play to 31"): The Non-Dealer plays the first card face-up into the play area. Players take turns playing one card at a time, keeping a cumulative running count of card values. Strict rule: You can NEVER play a card that causes the running count to exceed 31.',
      'Pegging Point Combos: You score points immediately as cards are placed during pegging: (1) Fifteen (+2 pts): Hitting a running total of exactly 15; (2) Thirty-One (+2 pts): Hitting a running total of exactly 31; (3) Pair (+2 pts): Playing a card of identical rank to the previous card; (4) Three of a Kind (+6 pts): Playing a 3rd identical rank in a row; (5) Four of a Kind (+12 pts): Playing a 4th identical rank in a row; (6) Runs (+1 pt per card): Playing 3 or more consecutive cards in any order (e.g. playing 7, then 9, then 8 scores 3 points for a run of 3; adding a 6 or 10 next scores 4 points).',
      'Calling "Go" & The Last Card: If you cannot legally play any card in your hand without exceeding 31, you must call "Go". Your opponent must then play as many remaining cards as possible without exceeding 31. The player who plays the final card before 31 scores +1 point for "Go" / Last Card (or +2 points if that last card hits exactly 31). Once 31 is reached or neither player can play, the count resets to 0 and players continue playing their remaining cards until all 8 cards are played.',
      'The Show (Counting Order & Walk-off Wins): After pegging finishes, all hands are scored using each player\'s 4 hand cards plus the 1 shared Starter Cut card. Hands are counted in strict tournament order: (1) Non-Dealer Hand first, (2) Dealer Hand second, (3) Dealer Crib third. Critical Walk-off Rule: Because the non-dealer counts first, if the non-dealer reaches 121 points during their count, they win instantly! The dealer does not even get to count their hand or crib.',
      'Hand & Crib Scoring Combinations: Every distinct combination of cards is evaluated: (1) Fifteens (2 pts each): Every combination of cards summing to 15 (e.g. 5+10, 7+8, 4+5+6, 9+3+2+A); (2) Pairs (2 pts each): Matching ranks (three of a kind = 6 pts, four of a kind = 12 pts); (3) Runs (1 pt per card): 3 or more consecutive ranks (double runs like 4-5-6-6 contain two runs of 3 plus a pair = 8 pts!); (4) Flushes (4 or 5 pts): 4 hand cards of matching suit = 4 pts (+1 pt if the cut card also matches; in the Crib, all 5 cards must match suit for 5 pts); (5) His Nobs (1 pt): Holding a Jack in your hand of the same suit as the Starter Cut card.',
    ],
    winningCondition: 'The first player whose front peg reaches or exceeds 121 points wins the match immediately! If the opponent has 90 points or fewer, they are "Skunked" (worth 2 match points in tournament play); 60 points or fewer is a "Double Skunk" (worth 3 match points).',
    proTip: 'When you are Dealer, seed your crib with high-synergy connectors like 5s, pairs, or 7-8. When opponent is Dealer, toss safe balking cards like King + low un-connected ranks.',
    proTips: [
      'Never Lead a 5: Because 16 out of 52 cards are worth 10 points (10, J, Q, K), leading a 5 gives your opponent an easy 15 for 2 points on their very first card.',
      'The Ideal Opening Lead is a 4: Statistically, leading a 4 is the strongest opening play in Cribbage. No single card makes 15 from 4, and if your opponent drops a 10 to make 14, you can counter with an Ace to score 15 for 2 points!',
      'Defend Against 21: Avoid playing a card that leaves the running count at 21, as your opponent can easily drop any 10-value card to claim 31 for 2 points.',
      'Balking Opponent\'s Crib: When your opponent is Dealer, toss cards with zero synergy like King + low card (e.g. K-2 or K-3) or wide splits like 9-A, making it nearly impossible for them to build 15s or runs.',
      'Seeding Your Own Crib: When you are Dealer, toss 5s, pairs, or consecutive connectors (like 7-8 or 6-7). Tossing a pair of 5s into your own crib guarantees at least 8 points if any 10-value card is cut!',
      'Walk-off Counting Priority: When trailing in late-game (e.g. past hole 110), Non-Dealer counts first during The Show. Prioritize maximizing hand points over defense—you can win at 121 before the dealer scores a single point!',
      'The Legendary 29-Point Hand: The highest mathematically possible score in Cribbage is 29 points (holding 5♣, 5♦, 5♥, and J♠ with the 5♠ cut as the starter card). It yields 16 points in 15s, 12 points in pairs, and 1 point for His Nobs!',
    ],
  },
};
