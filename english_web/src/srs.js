// SM-2 Spaced Repetition calculation engine
export const SRS_RATINGS = {
  AGAIN: 'again', // < 1m
  HARD: 'hard',   // 1d
  GOOD: 'good',   // 3d
  EASY: 'easy'    // 6d
};

export function processReview(card, rating) {
  const now = new Date();
  card.lastReviewed = now.toISOString();
  card.repetitionCount = (card.repetitionCount || 0) + 1;
  const ease = card.easeFactor || 2.5;

  let intervalDays = 0;
  let newEase = ease;

  switch (rating) {
    case SRS_RATINGS.AGAIN:
      intervalDays = 0.0007; // ~1 min
      newEase = Math.max(1.3, ease - 0.2);
      card.state = 'learning';
      break;

    case SRS_RATINGS.HARD:
      intervalDays = 1.0;
      newEase = Math.max(1.3, ease - 0.15);
      card.state = 'learning';
      break;

    case SRS_RATINGS.GOOD:
      if (card.repetitionCount <= 1) {
        intervalDays = 1.0;
      } else if (card.repetitionCount === 2) {
        intervalDays = 3.0;
      } else {
        intervalDays = Math.max(3.0, (card.intervalDays || 1) * ease);
      }
      card.state = intervalDays >= 21 ? 'mastered' : 'review';
      break;

    case SRS_RATINGS.EASY:
      if (card.repetitionCount <= 1) {
        intervalDays = 4.0;
      } else if (card.repetitionCount === 2) {
        intervalDays = 7.0;
      } else {
        intervalDays = Math.max(6.0, (card.intervalDays || 1) * ease * 1.3);
      }
      newEase = ease + 0.15;
      card.state = intervalDays >= 21 ? 'mastered' : 'review';
      break;
  }

  card.easeFactor = Math.round(newEase * 100) / 100;
  card.intervalDays = Math.round(intervalDays * 10) / 10;
  
  const due = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  card.dueDate = due.toISOString();

  return card;
}

export function formatInterval(card, rating) {
  const rep = card.repetitionCount || 0;
  const ease = card.easeFactor || 2.5;
  const currInterval = card.intervalDays || 1;

  switch (rating) {
    case SRS_RATINGS.AGAIN:
      return '1m';
    case SRS_RATINGS.HARD:
      return '1d';
    case SRS_RATINGS.GOOD:
      if (rep <= 1) return '2d';
      if (rep === 2) return '3d';
      return `${Math.round(currInterval * ease)}d`;
    case SRS_RATINGS.EASY:
      if (rep <= 1) return '4d';
      return `${Math.round(currInterval * ease * 1.3)}d`;
  }
}
