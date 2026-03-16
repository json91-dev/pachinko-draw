export function checkWinner(scores: number[], remainingBalls: number): number | null {
  if (scores.length === 0) return null;

  const indexed = scores.map((score, id) => ({ score, id }));
  indexed.sort((a, b) => b.score - a.score);

  const first = indexed[0];
  const second = indexed[1];

  // Early determination: even if all remaining balls went to 2nd place, 1st still wins
  if (second && first.score > second.score + remainingBalls) {
    return first.id;
  }

  // All balls exhausted
  if (remainingBalls === 0) {
    return first.id;
  }

  return null;
}
