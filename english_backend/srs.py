from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Union, Optional

def calculate_review(
    card_or_interval: Union[Dict[str, Any], float, int],
    rating_or_ease: Union[str, float] = "good",
    current_reps: Optional[int] = None,
    rating_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    SM-2 Spaced Repetition Calculation
    Accepts either:
      1) calculate_review(card_dict, rating_str)
      2) calculate_review(current_interval, current_ease, current_reps, rating_str)
    
    Returns a dictionary:
      {
        "due_date": str (ISO-8601),
        "interval_days": float,
        "ease_factor": float,
        "repetition_count": int,
        "state": str,
        "last_reviewed": str (ISO-8601)
      }
    """
    if isinstance(card_or_interval, dict):
        card = card_or_interval
        current_interval = float(card.get("interval_days") or 0.0)
        current_ease = float(card.get("ease_factor") or 2.5)
        current_reps_val = int(card.get("repetition_count") or 0)
        rating = str(rating_or_ease).lower().strip()
    else:
        current_interval = float(card_or_interval or 0.0)
        current_ease = float(rating_or_ease or 2.5)
        current_reps_val = int(current_reps or 0)
        rating = str(rating_str or "good").lower().strip()

    now = datetime.now(timezone.utc)
    new_reps = current_reps_val + 1

    if rating == 'again':
        # Reset interval to 1 minute
        interval_days = 0.0007 # ~1 minute
        new_ease = max(1.3, current_ease - 0.2)
        state = 'learning'
        new_due = now + timedelta(minutes=1)

    elif rating == 'hard':
        # 1 day interval
        interval_days = 1.0
        new_ease = max(1.3, current_ease - 0.15)
        state = 'learning'
        new_due = now + timedelta(days=1)

    elif rating == 'good':
        if new_reps <= 1:
            interval_days = 1.0
        elif new_reps == 2:
            interval_days = 3.0
        else:
            interval_days = max(3.0, (current_interval or 1.0) * current_ease)
        new_ease = current_ease
        state = 'mastered' if interval_days >= 21 else 'review'
        new_due = now + timedelta(days=round(interval_days))

    elif rating == 'easy':
        if new_reps <= 1:
            interval_days = 4.0
        elif new_reps == 2:
            interval_days = 7.0
        else:
            interval_days = max(6.0, (current_interval or 1.0) * current_ease * 1.3)
        new_ease = current_ease + 0.15
        state = 'mastered' if interval_days >= 21 else 'review'
        new_due = now + timedelta(days=round(interval_days))

    else:
        interval_days = 1.0
        new_ease = current_ease
        state = 'learning'
        new_due = now + timedelta(days=1)

    return {
        "due_date": new_due.isoformat(),
        "interval_days": round(interval_days, 2),
        "ease_factor": round(new_ease, 2),
        "repetition_count": new_reps,
        "state": state,
        "last_reviewed": now.isoformat()
    }

