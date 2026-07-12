# Open-Face Chinese Poker Rules — Standard Game Summary

> **Authoritative rules source:** [Wikipedia: Open-face Chinese poker](https://en.wikipedia.org/wiki/Open-face_Chinese_poker)  
> **Source revision used:** [oldid 1358338279](https://en.wikipedia.org/w/index.php?title=Open-face_Chinese_poker&oldid=1358338279), last edited June 8, 2026  
> **Scope:** Standard Open-Face Chinese Poker only. Rules identified by the source as variants are intentionally omitted.

This document summarizes the standard rules of Open-Face Chinese Poker (OFC) for use when implementing a game engine. Wikipedia is treated as the source of truth. Where the article does not fully specify an implementation detail, the gap is identified in **Ambiguous or unspecified rule areas** rather than presented as an official rule.

## 1. Game configuration

- Use one standard 52-card deck with no jokers.
- Support two to four players; two or three players are most common.
- Play proceeds clockwise, beginning with the player to the dealer's left.
- Each player receives and permanently places thirteen cards.
- There are no discards in standard OFC.
- All normally dealt and placed cards are face up.

Each player builds three poker hands:

| Row | Cards | Required strength |
|---|---:|---|
| Front (top) | 3 | Weakest, or tied for weakest |
| Middle | 5 | At least as strong as front and no stronger than back |
| Back (bottom) | 5 | Strongest, or tied for strongest |

A completed legal board therefore satisfies:

```text
back >= middle >= front
```

Equality between adjacent rows is allowed.

## 2. Dealing and placement

### Initial deal

Each player is dealt five cards. The player places all five face up into any available row positions.

The five cards do not need to be distributed among all three rows. For example, all five may be placed in the middle or back row, or split among two or three rows, provided no row exceeds its capacity.

### Remaining deal

After the initial five cards, each player receives eight additional cards, one at a time. Every card must immediately be placed face up into a non-full row.

```text
5 initial cards + 8 single-card deals = 13 cards
```

Once a card is placed, it cannot be moved. The engine should reject placement into a full row or any attempt to move a committed card, but it should not reject a placement merely because the resulting board may eventually foul.

The placement phase ends when every player has exactly three cards in front, five in the middle, and five in back.

## 3. Hand evaluation

### Middle and back rows

The five-card rows use ordinary poker hand rankings, strongest to weakest:

1. Royal flush
2. Straight flush
3. Four of a kind
4. Full house
5. Flush
6. Straight
7. Three of a kind
8. Two pair
9. One pair
10. High card

A royal flush may be represented internally as the highest straight flush, but it must remain identifiable because it has a distinct royalty value.

### Front row

The three-card front row recognizes only:

1. Three of a kind
2. One pair
3. High card

Straights, flushes, and straight flushes do not exist as front-row hand classes. A three-card sequence or three cards of one suit are therefore evaluated only by matching ranks and high cards.

Equal hand classes should be compared using normal rank and kicker rules. Suits do not break ties.

### Comparing rows for board legality

Board legality is based on poker strength, not royalty value:

```text
legal = compare(back, middle) >= 0
     && compare(middle, front) >= 0
```

Examples of fouled boards include:

- a front pair that outranks a middle pair;
- front three of a kind with only two pair in the middle;
- a middle flush with only a straight in back.

## 4. Fouling

A player fouls by completing a board that does not satisfy `back >= middle >= front`.

Against each legal opponent, a fouled player:

- loses six points;
- receives no royalties; and
- also loses the value of the legal opponent's royalties.

Thus, when player A is legal and player B fouls:

```text
score(A versus B) = 6 + A's royalties
score(B versus A) = -(6 + A's royalties)
```

If both players in a pairwise comparison foul, they score zero against one another and receive no royalties from those fouled boards. Each is still compared normally against any legal players at the table.

## 5. Standard 1–6 scoring

Every player is compared independently against every other player.

For two legal boards, compare corresponding rows only:

```text
front  vs front
middle vs middle
back   vs back
```

Each row is worth:

- win: `+1`;
- loss: `-1`;
- tie: `0` as the recommended default described later.

Winning all three rows is a scoop and adds three bonus points. The total base result of a scoop is therefore six points: three row points plus the three-point scoop bonus.

For two legal players:

```text
rowDelta = frontResult + middleResult + backResult

scoopDelta =
    +3 if all three rows are won
    -3 if all three rows are lost
     0 otherwise

scoreDelta = rowDelta
           + scoopDelta
           + playerRoyalties
           - opponentRoyalties
```

Royalties are independent of row wins. A player may earn a royalty for a row even when that row loses, provided the complete board is legal.

At a multiplayer table, score every unordered pair separately and sum each player's pairwise results. The total of all players' final point changes must equal zero.

## 6. Royalties

Royalties are awarded only on legal boards and are netted pairwise between legal opponents.

### Front-row royalties

Pairs of twos through fives earn zero. Pairs of sixes through aces earn one through nine points:

| Pair | 66 | 77 | 88 | 99 | TT | JJ | QQ | KK | AA |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Points | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |

Three of a kind earns ten points for three twos, increasing by one point per rank through twenty-two points for three aces:

```text
222 = 10, 333 = 11, ... , KKK = 21, AAA = 22
```

### Middle-row royalties

| Hand | Points |
|---|---:|
| Three of a kind | 2 |
| Straight | 4 |
| Flush | 8 |
| Full house | 12 |
| Four of a kind | 20 |
| Straight flush | 30 |
| Royal flush | 50 |

High card, one pair, and two pair earn no middle-row royalty.

### Back-row royalties

| Hand | Points |
|---|---:|
| Straight | 2 |
| Flush | 4 |
| Full house | 6 |
| Four of a kind | 10 |
| Straight flush | 15 |
| Royal flush | 25 |

High card, one pair, two pair, and three of a kind earn no back-row royalty.

A player's total royalty is the sum of all qualifying rows on that legal board.

## 7. Fantasyland

Wikipedia presents Fantasyland as part of normal OFC gameplay rather than as a variant.

### Entering Fantasyland

A player qualifies for Fantasyland on the next hand by completing a legal board with a pair of queens or stronger in front.

For engine purposes, this includes:

- pair of queens;
- pair of kings;
- pair of aces; or
- any three of a kind.

A fouled board never qualifies.

### Playing in Fantasyland

On the following hand, a Fantasyland player receives all thirteen cards at once, arranges them into the three rows, and sets the board face down. Other players continue using normal open-face dealing and placement. More than one player may be in Fantasyland during the same hand.

### Remaining in Fantasyland

A player already in Fantasyland remains there for another hand by completing a legal board and making at least one of:

- any three of a kind in front;
- a full house or stronger in the middle; or
- four of a kind or stronger in back.

Only one of these conditions is required. A player who requalifies must declare it to the opponents.

## 8. Round resolution

A deterministic engine should resolve a completed hand in this order:

1. Confirm each board contains `3 / 5 / 5` cards.
2. Evaluate every row and generate comparison keys.
3. Mark each board legal or fouled.
4. Calculate royalties for legal boards only.
5. Score every unordered pair of players.
6. Sum each player's pairwise score changes.
7. Determine next-hand Fantasyland status.
8. Persist the board, score breakdown, and Fantasyland result.

Fantasyland qualification depends only on the player's own completed legal board, not on winning the hand.

## 9. Ambiguous or unspecified rule areas

The source article does not completely define the following details. They should be explicit engine-policy choices, not labeled as official Wikipedia rules.

### Tied rows

The article states that a player receives a point for beating a corresponding row but does not explicitly define equal rows.

Recommended default:

```text
A tied row gives 0 points to both players.
Suits do not break ties.
```

### Dealer selection and rotation

The source identifies the first acting position as left of the dealer but does not define how the initial dealer is chosen or how the button moves.

Recommended default:

```text
Choose the first dealer by table policy.
Rotate the dealer one seat clockwise after every completed hand.
```

### Timing of single-card deals

The article establishes clockwise play but does not fully specify whether all players receive a card before anyone acts or whether each card is revealed when its player acts.

Recommended online-engine default:

```text
Process players clockwise.
Reveal a player's new card when that player's action begins.
Commit the placement before advancing to the next player.
```

This choice affects how much information later players can observe during a deal cycle.

### Fantasyland reveal timing

The source says Fantasyland boards are set face down but does not identify the exact reveal event.

Recommended default:

```text
Reveal all Fantasyland boards at showdown after ordinary players finish placement.
```

### Complete poker-evaluator behavior

The OFC article relies on standard poker rankings and does not restate every kicker rule, split-pot comparison, or special straight case. The engine should use a conventional poker evaluator and test it independently from OFC board legality and scoring.

## 10. Core scoring pseudocode

```text
function scorePair(a, b):
    if a.fouled and b.fouled:
        return 0

    if not a.fouled and b.fouled:
        return 6 + a.royalties

    if a.fouled and not b.fouled:
        return -(6 + b.royalties)

    results = [
        compare(a.front, b.front),
        compare(a.middle, b.middle),
        compare(a.back, b.back)
    ]

    rowDelta = sum(results)  // each is -1, 0, or +1
    scoopDelta = 0

    if results == [+1, +1, +1]:
        scoopDelta = +3
    else if results == [-1, -1, -1]:
        scoopDelta = -3

    return rowDelta
         + scoopDelta
         + a.royalties
         - b.royalties
```

For a full round, apply this function to every unordered pair and add the returned delta to the first player and its negative to the second.