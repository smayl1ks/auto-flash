from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class WordCardBase(BaseModel):
    word: str
    transcription: str = ""
    part_of_speech: str = "general"
    category: str = "general"
    cefr_level: str = "B1"
    frequency: str = "8/10"
    relevance: str = "высокая"
    translation: str
    definition_en: str = ""
    examples: List[str] = []
    collocations: List[str] = []
    dictionary_source: str = "Cambridge Advanced Learner's Dictionary"

class WordCardCreate(WordCardBase):
    user_id: Optional[int] = None

class WordCardResponse(WordCardBase):
    id: int
    user_id: int
    due_date: str
    interval_days: float = 0.0
    ease_factor: float = 2.5
    repetition_count: int = 0
    state: str = "new"
    last_reviewed: Optional[str] = None

class GeneratePreviewRequest(BaseModel):
    word: str
    user_id: Optional[int] = None
    feedback: Optional[str] = None
    previous_card: Optional[Dict[str, Any]] = None

class GenerateBatchPreviewRequest(BaseModel):
    words: List[str]
    user_id: Optional[int] = None

class BatchCardsCreate(BaseModel):
    cards: List[WordCardCreate]
    user_id: Optional[int] = None

class UserRegisterRequest(BaseModel):
    login: str
    password: str
    name: Optional[str] = None

class UserLoginRequest(BaseModel):
    login: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    name: str
    created_at: str

class ReviewRequest(BaseModel):
    rating: str = Field(..., description="'again', 'hard', 'good', or 'easy'")

class StatsResponse(BaseModel):
    total_cards: int
    due_today: int
    mastered_cards: int
    cefr_breakdown: dict
    categories_breakdown: dict
