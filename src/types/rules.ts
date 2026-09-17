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
}

export const GAME_RULES: Record<GameId, GameRule> = {
  mancala: {
    gameId: 'mancala',
    title: 'Mancala',
    category: 'Ancient Strategy',
    objective: 'Collect the most glass stones in your store (the large cup on your right side).',
    setup: 'Each player has 6 small pits with 4 stones each, plus 1 large store to their right.',
    howToPlay: [
      'On your turn, tap any of your 6 pits containing stones.',
      'All stones from that pit are scooped up and sown counter-clockwise, 1 stone per pit, into your pits, your store, and your opponent pits (skipping the opponent store).',
      'If the last sown stone lands in your own store, you immediately earn an EXTRA TURN!',
      'If the last sown stone lands in an empty pit on your own side, you capture that stone PLUS all stones in the opposing pit opposite to it into your store.',
    ],
    winningCondition: 'When one player clears all 6 of their pits, remaining stones are swept into their owner stores. The player with the most total stones in their store wins!',
    proTip: 'Plan your moves to land your final stone in your store on pit 6 to chain multiple consecutive turns.',
  },

  'connect-four': {
    gameId: 'connect-four',
    title: 'Connect Four',
    category: 'Vertical Grid',
    objective: 'Be the first player to form an unbroken horizontal, vertical, or diagonal line of 4 discs.',
    setup: 'A vertical 7-column by 6-row grid. Player 1 uses Cobalt blue discs, Player 2 uses Crimson red discs.',
    howToPlay: [
      'Players alternate turns dropping one disc into any of the 7 columns.',
      'The disc falls straight down to occupy the lowest unoccupied slot in that column.',
      'You cannot play into a column that is already completely full (6 discs).',
      'Watch both your offensive lines and your opponent potential winning rows.',
    ],
    winningCondition: 'First player to connect 4 matching discs in a continuous straight row (horizontal, vertical, or diagonal) wins immediately. If all 42 slots are filled with no 4-in-a-row, it is a draw.',
    proTip: 'Controlling the center column (Column 4) provides the most potential winning vectors across the board.',
  },

  'dots-and-boxes': {
    gameId: 'dots-and-boxes',
    title: 'Dots and Boxes',
    category: 'Pencil & Paper',
    objective: 'Complete and capture more square boxes than your opponent.',
    setup: 'A 4x4 grid of dots forming a 3x3 array of 9 capturable square boxes.',
    howToPlay: [
      'Players alternate turns tapping between two adjacent horizontal or vertical dots to draw a connecting edge line.',
      'When a player draws the fourth edge completing a 1x1 box, that box is claimed with their team color and score.',
      'Crucial rule: Completing a box awards an EXTRA MOVE immediately!',
      'You can chain multiple box completions in a single turn if successive boxes are closed.',
    ],
    winningCondition: 'When all 9 boxes have been completed, the player who captured 5 or more boxes wins.',
    proTip: 'Avoid drawing the 3rd side of any box unless you can claim the full chain or force an advantageous trade.',
  },

  'speed': {
    gameId: 'speed',
    title: 'Speed',
    category: 'Rapid Card Game',
    objective: 'Be the first player to get rid of all cards in your hand and reserve draw pile.',
    setup: 'A standard deck split between two players. Each player has 5 cards in hand, a personal draw pile, and there are 2 shared center discard piles.',
    howToPlay: [
      'Both players act simultaneously in real time (no turns!).',
      'Select a card from your hand and tap a center discard pile if its rank is exactly 1 higher or 1 lower (+1 or -1).',
      'Rank wraps around: Aces can be played on Kings, and Kings can be played on Aces (A-2-3...Q-K-A).',
      'Tap your Draw pile whenever your hand drops below 5 cards to replenish.',
      'If neither player can legally play any card from hand, tap "Flip New Center Cards" to reset the center table.',
    ],
    winningCondition: 'The player who empties both their hand and their reserve draw pile first wins the race!',
    proTip: 'Keep both hands ready and watch both center piles—swift reactions to changing top cards are key.',
  },

  'yacht-dice': {
    gameId: 'yacht-dice',
    title: 'Yacht Dice',
    category: 'Dice & Scoring',
    objective: 'Score the highest total points by filling all 12 combinations on your scorecard.',
    setup: '5 standard 6-sided dice and a 12-category scorecard for each player.',
    howToPlay: [
      'On your turn, you have up to 3 rolls of the dice.',
      'After the first roll, tap any dice on the left vertical tray to HOLD them, preserving their values.',
      'Roll the remaining unheld dice again to improve your hand.',
      'After 1, 2, or 3 rolls, tap an available category on your right scorecard to record your score.',
      'Each category can only be chosen once per game. Choose carefully, as low rolls can result in a 0 if placed in the wrong slot!',
      'Upper Section: Ones through Sixes (Sum of matching dice). If your Upper Section sum reaches 63 or higher, you earn a +35 point Bonus!',
      'Lower Section: Choice (Sum all), 4 of a Kind (Sum all), Full House (25 pts), Small Straight (30 pts), Large Straight (40 pts), and Yacht (5 of a kind -> 50 pts).',
    ],
    winningCondition: 'Once all 12 categories are filled by both players, the player with the highest grand total score wins.',
    proTip: 'Target at least three of each number in the upper section (1s through 6s) to guarantee the 35-point Upper Bonus.',
  },

  'renegade': {
    gameId: 'renegade',
    title: 'Renegade (Reversi)',
    category: 'Classic Reversi',
    objective: 'Finish the game with the majority of discs in your color.',
    setup: 'An 8x8 green board with 4 center discs (2 Dark, 2 Light in alternating diagonal positions).',
    howToPlay: [
      'Players alternate placing a disc of their color on an empty square.',
      'A move is only legal if the placed disc and an existing disc of your color trap one or more opponent discs in a continuous straight line (horizontal, vertical, or diagonal).',
      'All trapped opponent discs flip over to your color.',
      'If a player has no legal moves available, their turn is automatically passed to the opponent.',
    ],
    winningCondition: 'The game ends when the board is full or neither player can make a legal move. The player with the most discs on the board wins.',
    proTip: 'Corners can never be flipped! Prioritize capturing the 4 corner squares and avoid placing discs adjacent to open corners.',
  },

  'air-hockey': {
    gameId: 'air-hockey',
    title: 'Air Hockey',
    category: 'Tabletop Action',
    objective: 'Score 7 goals into your opponent goal slot while defending your own goal line.',
    setup: 'Vertical split-screen rink with center red line. Player 1 controls the bottom mallet; Player 2 controls the top mallet.',
    howToPlay: [
      'Touch and drag your mallet to strike the puck. Player 1 is restricted to the bottom half; Player 2 to the top half.',
      'The speed and direction of your finger swipe transfers physical momentum to the puck.',
      'Bounce the puck off side walls to catch your opponent off guard with bank shots.',
      'Desktop controls: Mouse drag or Arrow Keys for Player 1, WASD for Player 2. Tap or press Space to serve.',
    ],
    winningCondition: 'First player to reach 7 goals wins the match!',
    proTip: 'Do not chase the puck into corners; hold your ground near your goal slot and strike through the puck as it approaches.',
  },

  'toy-tennis': {
    gameId: 'toy-tennis',
    title: 'Toy Tennis',
    category: 'Retro Arcade',
    objective: 'Rally the ball across the center net and score 5 points.',
    setup: 'Top-down arcade court with a center net. Player 1 defends bottom baseline; Player 2 defends top baseline.',
    howToPlay: [
      'Slide your paddle along the baseline to intercept and return the incoming ball.',
      'The ball has 3D altitude (z-axis) and bounces off the court surface.',
      'Returns must clear the center net height without clipping the net tape.',
      'Hitting near the paddle center provides a sweet-spot upward arc and increased return speed.',
      'Desktop controls: Left/Right arrow keys for Player 1, A/D keys for Player 2.',
    ],
    winningCondition: 'A point is scored when your opponent fails to return the ball or hits the net. First to 5 points wins!',
    proTip: 'Strike the ball early on its upward bounce to send a fast, angled shot across the court.',
  },

  'carrom': {
    gameId: 'carrom',
    title: 'Carrom',
    category: 'Strike & Pocket',
    objective: 'Pocket all of your assigned carrom men (White for P1, Black for P2) plus the high-value Red Queen.',
    setup: 'Square wooden board with 4 corner pockets. Carrom men arranged in a central ring around the Queen.',
    howToPlay: [
      'Position your large striker along your baseline touching both baseline boundary lines.',
      'Drag backward from the striker to set shot power and aim vector; release to strike.',
      'White pieces = 10 pts (P1 target), Black pieces = 10 pts (P2 target), Red Queen = 25 pts.',
      'Pocketing the Queen requires "covering": you must pocket one of your own pieces on the same or subsequent shot to claim her points.',
      'Pocketing the striker is a foul and incurs a penalty.',
    ],
    winningCondition: 'The game ends when all pieces of one color are pocketed. The player with the most points wins.',
    proTip: 'Use smooth bank shots off the outer wooden edges to pocket pieces tucked behind obstacles.',
  },

  'gomoku': {
    gameId: 'gomoku',
    title: 'Gomoku',
    category: 'Five in a Row',
    objective: 'Form an unbroken horizontal, vertical, or diagonal row of exactly 5 stones.',
    setup: 'A 15x15 wooden intersection grid. Player 1 plays Black stones; Player 2 plays White stones.',
    howToPlay: [
      'Players alternate turns placing one stone on an unoccupied grid intersection.',
      'Black makes the opening move at any intersection.',
      'Stones cannot be moved once placed.',
      'Look for "open threes" and "fours"—chains of stones open on both ends that your opponent cannot block in a single move.',
    ],
    winningCondition: 'The first player to align 5 or more consecutive stones horizontally, vertically, or diagonally wins immediately.',
    proTip: 'Create double-threat formations (like a 3-and-3 or 4-and-3 intersection) that leave your opponent unable to defend both attack vectors.',
  },

  'checkers': {
    gameId: 'checkers',
    title: 'Checkers (Draughts)',
    category: 'Draughts Strategy',
    objective: 'Capture all of your opponent checkers or leave them with no legal moves.',
    setup: '8x8 board with 12 pieces per player placed on the dark squares of the first 3 rows.',
    howToPlay: [
      'Regular pieces move diagonally forward 1 square onto an open dark square.',
      'Jump Captures: If an opponent piece is diagonally adjacent forward and the square immediately beyond is empty, you must jump over it, removing it from play.',
      'Multi-Jumps: If another jump is immediately available from the landing square, you must continue jumping in the same turn.',
      'Mandatory Jumping: If any jump is available on your turn, you are required to capture.',
      'King Promotion: Reaching the opponent back row crowns your piece as a King. Kings can move and jump both forward and backward!',
    ],
    winningCondition: 'Capture all opponent pieces or block them so they have no legal moves remaining.',
    proTip: 'Advance your back row cautiously; keeping your rear guard intact prevents opponent pieces from easily promoting to Kings.',
  },

  'backgammon': {
    gameId: 'backgammon',
    title: 'Backgammon',
    category: 'Points & Tables',
    objective: 'Move all 15 of your checkers into your Home Board and bear them off the table before your opponent.',
    setup: '24 triangular points. Player 1 moves counter-clockwise from point 24 down to 1 (Home: 1-6). Player 2 moves clockwise from point 1 up to 24 (Home: 19-24).',
    howToPlay: [
      'Roll 2 dice at the start of your turn. The numbers indicate how many points you can advance one or two checkers.',
      'Rolling doubles (e.g. 4-4) lets you play the rolled number 4 times!',
      'An open point is any point with fewer than 2 opponent checkers. You cannot land on a point with 2 or more opponent checkers (blocked).',
      'Hitting: Landing on a point with a single solitary opponent checker ("blot") sends it to the central Bar.',
      'Re-entry: Checkers on the Bar must re-enter into the opponent furthest home quadrant before any other checkers can move.',
      'Bearing Off: Once all 15 of your checkers are inside your 6-point Home Board, you can begin rolling dice to remove them from the board.',
    ],
    winningCondition: 'The first player to bear off all 15 checkers wins the match.',
    proTip: 'Do not leave lone single checkers ("blots") within direct roll distance (1-6 points) of opponent pieces.',
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
  },

  darts: {
    gameId: 'darts',
    title: 'Darts',
    category: 'Pub Precision',
    objective: 'Score points by throwing 3 darts per turn at the bristle sisal board to reduce your score to 0 (501) or close target numbers (Cricket).',
    setup: 'A standard 20-segment sisal dartboard featuring inner triple rings (3x), outer double rings (2x), and a center bullseye (25 / 50 pts).',
    howToPlay: [
      '501 Countdown: Both players start at 501. Each dart subtracts from your total. First to reach exactly 0 wins! Going below 0 is a Bust (turn score discarded).',
      'Cricket Mode: Players race to close numbers 15 through 20 and the Bullseye by landing 3 marks on each. Closed numbers score points until the opponent closes them.',
      'Throwing: Touch and swipe upward toward your target. Your swipe release velocity and release angle determine dart flight and arc.',
      'Turn Flow: Each player throws 3 darts. Darts stay pinned in the board until round completion for tactile pass-and-play.',
    ],
    winningCondition: 'In 501: First to reach exactly 0. In Cricket: First to close all 7 target sectors with a score equal to or higher than the opponent.',
    proTip: 'Smooth, consistent upward swipes produce much tighter groupings than erratic, flicked gestures.',
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
    proTip: 'Aim for the "pocket" between Pin 1 and Pin 3 (for right-curving hooks) to trigger maximum chain-reaction pin scatter.',
  },

  'mini-shogi': {
    gameId: 'mini-shogi',
    title: 'Mini Shogi (5x5)',
    category: 'Japanese Chess',
    objective: 'Checkmate or capture the opponent King on a compact 5x5 board using strategic piece drops and promotions.',
    setup: 'A 5x5 wooden board. Each player commands King, Gold, Silver, Bishop, Rook, and Pawn, with side trays (komadai) for captured reserves.',
    howToPlay: [
      'Movement: King moves 1 square in all 8 directions; Gold moves 1 square orthogonally or diagonally forward; Silver moves 1 square forward or in all 4 diagonals.',
      'Bishop moves any distance diagonally; Rook moves any distance orthogonally; Pawn moves 1 square straight forward.',
      'The Drop Rule (Uchi): Captured opponent pieces enter your reserve tray. On your turn, you may drop a reserve piece onto any vacant square instead of moving a board piece.',
      'Promotion: Reaching the opponent back rank (Rank 5 for P1, Rank 1 for P2) lets Pawn, Silver, Bishop, and Rook promote to powerful forms (Tokin, Narigin, Horse, Dragon).',
      'Restrictions: Dropping a Pawn to create an immediate checkmate (Uchifuzume) or dropping two unpromoted Pawns in the same column (Nifu) is illegal.',
    ],
    winningCondition: 'Checkmate the opponent King so it cannot escape capture.',
    proTip: 'Dropped pieces retain their captured orientation and can be placed behind enemy lines for surprise tactical strikes.',
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
      'Scoring: At the end of all 8 stones, the player with the stone closest to the button scores 1 point for each stone closer than the opponent nearest stone.',
    ],
    winningCondition: 'Player with the highest cumulative points after the match ends wins.',
    proTip: 'Place guard stones in front of the house early, then curl your scoring stones safely behind them.',
  },

  hex: {
    gameId: 'hex',
    title: 'Hex',
    category: 'Connection Strategy',
    objective: 'Create an unbroken connected chain of friendly gems connecting your two opposing board borders.',
    setup: 'An 11x11 diamond rhombic board of hexagonal cells. Player 1 connects Cobalt Blue (top-left to bottom-right); Player 2 connects Crimson Red (top-right to bottom-left).',
    howToPlay: [
      'Players alternate tapping any vacant hexagonal recess to place a colored acrylic gem.',
      'Hex gems connect through any of their 6 adjacent neighboring hexes.',
      'Borders count as connected if a friendly gem occupies any hex along that perimeter.',
      'No captures, no piece movement: once placed, gems remain in place for the entire match.',
    ],
    winningCondition: 'The first player to form an unbroken path connecting their two opposite board sides wins immediately. Draws are mathematically impossible!',
    proTip: 'Use "virtual connections" (two shared neighbor bridge cells) to guarantee links even if your opponent tries to block.',
  },

  matching: {
    gameId: 'matching',
    title: 'Matching (Memory)',
    category: 'Memory & Focus',
    objective: 'Flip cards and find the most matching pairs of tabletop icons across the baize grid.',
    setup: 'A 6x4 grid of 24 linen-embossed cards containing 12 unique matching pairs of procedural tabletop game artifacts.',
    howToPlay: [
      'On your turn, tap card 1 to reveal its hidden icon, then tap card 2.',
      'If the two cards match: You keep the pair face-up, score 1 point, and earn an IMMEDIATE BONUS TURN!',
      'If the cards do not match: Both cards flip back face-down after a brief glance, and the turn passes to your opponent.',
    ],
    winningCondition: 'When all 12 pairs have been matched, the player with the most collected pairs wins.',
    proTip: 'Pay close attention to cards flipped over on your opponent turn to remember their grid coordinates.',
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
  },

  'hare-and-hounds': {
    gameId: 'hare-and-hounds',
    title: 'Hare and Hounds',
    category: 'Asymmetric Pursuit',
    objective: 'Hounds try to trap the agile Hare, while the Hare attempts to escape past the hound line or outlast them.',
    setup: 'An 11-node stone slab track. Player 1 controls 3 bronze Hounds starting on the left; Player 2 controls 1 copper Hare on the right.',
    howToPlay: [
      'Hounds (P1): Can move one step forward or vertically along connected edges. Hounds CANNOT retreat backward!',
      'Hare (P2): Can move one step in ANY direction (forward, backward, or vertical) along connected edges.',
      'Only one token moves per turn, alternating between Hounds and Hare.',
    ],
    winningCondition: 'Hounds win if they trap the Hare so it has no legal moves. Hare wins if it bypasses the hounds (reaches a column to the left of all 3 hounds) or if 10 consecutive moves pass without hounds advancing.',
    proTip: 'Hounds must advance as a coordinated vertical wall to prevent the Hare from slipping through gaps.',
  },

  'hit-and-blow': {
    gameId: 'hit-and-blow',
    title: 'Hit and Blow',
    category: 'Code Deduction',
    objective: 'Deduce the secret 4-color code combination through tactical color placement and deductive logic feedback.',
    setup: 'A 10-row wooden peg console with 6 vibrant peg colors (Red, Blue, Green, Yellow, Orange, Purple) and a secret 4-peg code.',
    howToPlay: [
      'Select 4 colored pegs to place in the current guess row, then tap Submit.',
      'Hit (Black Peg): A peg matches both the correct color AND the exact socket position.',
      'Blow (White Peg): A peg matches the correct color, but is in the wrong position.',
      'Use the deduction clues from earlier rows to eliminate impossible combinations on subsequent guesses.',
    ],
    winningCondition: 'Crack the code by scoring 4 Hits within 10 guesses to win!',
    proTip: 'Test distinct colors on your first two rows to quickly isolate which colors are present in the secret code.',
  },

  hanafuda: {
    gameId: 'hanafuda',
    title: 'Hanafuda (Koi-Koi)',
    category: 'Traditional Japanese',
    objective: 'Capture cards by matching floral suits to form high-scoring combinations (Yaku) and decide when to cash out or call Koi-Koi.',
    setup: '48 floral cards across 12 months. 8 cards dealt to each player, 8 to the central field, and 24 in the draw deck.',
    howToPlay: [
      '1. Hand Match: Play a card from hand. If its flower suit matches a card on the field, you capture both into your scoring tray. If no match, your card stays on the field.',
      '2. Deck Draw: Flip the top card of the draw deck. If it matches a field card, capture both into your tray; otherwise, place it on the field.',
      '3. Form Yaku: Captured cards build Yaku: Brights (Crane, Moon, Curtain, Rainman, Phoenix), Animals (Boar-Deer-Butterfly), Ribbons (Poetry & Blue), and Chaff (Kasu).',
      '4. Push-Your-Luck: When you complete a Yaku, decide whether to STOP (claim your points and win round) or call KOI-KOI (continue to hunt for more points, risking your opponent finishing first).',
    ],
    winningCondition: 'If you call STOP with an active Yaku, you bank that score. If your opponent scores after your Koi-Koi, they win and you get 0 points!',
    proTip: 'The Chrysanthemum Sake Cup is the most versatile card: it counts as an Animal AND forms the 5-point Moon-Viewing and Cherry-Viewing combinations.',
  },

  president: {
    gameId: 'president',
    title: 'President (Daifugo)',
    category: 'Card Climbing Duel',
    objective: 'Be the first player to shed all cards from your hand by playing increasingly higher card combinations.',
    setup: 'Standard 54-card deck (including 2 Jokers). Each player receives 18 cards sorted from 3 (lowest) to 2 (highest), with Jokers as wild / highest.',
    howToPlay: [
      'The lead player plays any valid single, pair, triple, or 4-of-a-kind.',
      'The opponent must play a combination of the EXACT same quantity with a higher rank, or choose to pass.',
      'Passing does not lock you out forever; when neither player can beat the pile, the stack clears and the last player to play leads a fresh combination.',
      '8-End (Hachi-Giri): Any play containing an 8 immediately clears the discard pile and grants you the lead!',
      'Revolution (Kakumei): Playing a 4-of-a-kind reverses rank hierarchy for the rest of the round: 3 becomes highest, 2 becomes lowest!',
    ],
    winningCondition: 'The first player to empty their hand wins the round and claims the title of President!',
    proTip: 'Save an 8 or a 2 to seize control of the board when your opponent is holding a low card count.',
  },

  'last-card': {
    gameId: 'last-card',
    title: 'Last Card',
    category: 'Action Card Shedding',
    objective: 'Shed all cards from your hand by matching the top card of the discard pile by Rank or Suit.',
    setup: 'Each player receives 7 cards. One card is flipped face-up to begin the center discard pile.',
    howToPlay: [
      'On your turn, play a card that matches the active discard pile in either Suit or Rank.',
      '2s (Draw Two): Forces opponent to draw 2 cards. If the opponent counters with another 2, the penalty stacks (+4, +6)!',
      'Aces (Play Again): Grants the player an immediate extra turn.',
      'Jacks (Skip): In 2-player mode, skips the opponent and returns turn to you.',
      '8s (Wild Card): Can be played on any card; opens a picker to declare a new active suit.',
      'Last Card Callout: When playing down to your final card, tap "LAST CARD" before discarding! Failing to call it incurs a 2-card penalty draw.',
    ],
    winningCondition: 'First player to play their final card wins the match!',
    proTip: 'Chain an Ace into an 8 to change the suit and finish your hand in a single explosive turn.',
  },

  'riichi-mahjong': {
    gameId: 'riichi-mahjong',
    title: 'Riichi Mahjong',
    category: 'Tile Strategy Duel',
    objective: 'Build a winning 14-tile hand composed of 4 sets (melds) and 1 pair with at least 1 valid Yaku.',
    setup: 'Fast 2-player Sanma set (108 tiles): Pinzu (Dots), Souzu (Bamboo), 1 & 9 Manzu terminals, Winds (East, South, West, North), and Dragons (White, Green, Red). 13 tiles dealt each.',
    howToPlay: [
      'Draw a tile on your turn to reach 14 tiles, evaluate melds (triplets or sequences), and discard one unwanted tile into your river (kawa).',
      'Call Pon: Call opponent discard to complete a triplet (3 identical tiles).',
      'Declare Riichi: When 1 tile away from winning (Tenpai) on a closed hand, tap Riichi, deposit a 1,000-pt tenbo stick, and enter auto-draw mode.',
      'Win with Ron or Tsumo: Call Ron when opponent discards your winning tile, or call Tsumo when you draw it yourself.',
      'Valid Yaku Required: Hand must have at least 1 Yaku (Riichi, Tanyao/All Simples, Dragons/Winds, Honitsu/Half Flush, Toitoi/All Triplets, or Seven Pairs).',
    ],
    winningCondition: 'First player to complete a valid Yaku hand wins the round payout (Mangan 8,000, Haneman 12,000) or bankrupts the opponent!',
    proTip: 'Tanyao (All Simples) is the easiest and fastest hand: discard all 1s, 9s, and Honor tiles, and build entirely with numbers 2 through 8.',
  },
};

