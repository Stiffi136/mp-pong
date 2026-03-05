# MP-PONG

Multiplayer Pong in the browser — 2 to 8 players compete in a polygon arena.

## Play

Open **[https://stiffi136.github.io/mp-pong/](https://stiffi136.github.io/mp-pong/)** in your browser.

### Create a Room

1. Click **Play**
2. Enter your name and click **Join**
3. Share the URL (with the `#room-id` hash) with your friends
4. Click **Ready** once everyone has joined — the game starts when all players are ready

### Join a Room

- Open the link you received, or
- Click **Join**, enter the room ID, and press Enter

## Controls

| Input         | Action             |
| ------------- | ------------------ |
| `←` / `A`     | Move paddle left   |
| `→` / `D`     | Move paddle right  |
| Touch buttons | For mobile devices |

## Rules

- Each player defends one side of the polygon with their paddle
- The ball bounces off walls and paddles
- Miss the ball and you lose a life (3 total)
- Lose all lives and you're eliminated
- Last player standing wins

### Difficulty Scaling

Every 30 seconds the difficulty increases:

- Ball speed increases by **20%**
- Paddle size decreases by **20%**

The HUD timer shows the countdown to the next level.
