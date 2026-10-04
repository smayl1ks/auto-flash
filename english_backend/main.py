import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Configure structured logging with timestamp, level and logger name
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("autoflash.server")

# Load environment variables (e.g. GEMINI_API_KEY from .env)
load_dotenv()

from database import get_db, init_db, row_to_card, row_to_user, hash_password
from models import (
    WordCardCreate,
    WordCardResponse,
    ReviewRequest,
    GeneratePreviewRequest,
    GenerateBatchPreviewRequest,
    BatchCardsCreate,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    StatsResponse
)
from srs import calculate_review
from ai_engine import generate_word_card_preview, generate_word_cards_batch

app = FastAPI(
    title="AutoFlash API",
    description="Backend for AutoFlash Spaced Repetition English Cards & AI Engine",
    version="2.0.0"
)

# Enable CORS for frontend development and Docker networking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else "unknown"
    method = request.method
    url = str(request.url.path)
    if request.url.query:
        url += f"?{request.url.query}"

    response: Response = await call_next(request)
    duration_ms = int((time.perf_counter() - start_time) * 1000)

    log_msg = f"{method} {url} -> Status {response.status_code} ({duration_ms}ms) [Client: {client_ip}]"
    if response.status_code >= 400:
        logger.warning(log_msg)
    else:
        logger.info(log_msg)

    return response

@app.on_event("startup")
def on_startup():
    logger.info("🚀 Starting AutoFlash API server...")
    init_db()
    logger.info("📦 Database initialized and ready.")

@app.get("/")
def read_root():
    return {"status": "ok", "app": "AutoFlash SRS & AI Backend", "version": "2.0.0"}

# ==============================================================================
# AUTHENTICATION
# ==============================================================================

@app.post("/api/auth/login")
def login(req: UserLoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    pwd_hash = hash_password(req.password)

    cursor.execute("""
    SELECT * FROM users WHERE (username = ? OR email = ?) AND password_hash = ?
    """, (req.login.strip(), req.login.strip(), pwd_hash))
    user = cursor.fetchone()
    conn.close()

    if not user:
        logger.warning(f"🔒 Failed login attempt for user='{req.login.strip()}'")
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    user_dict = row_to_user(user)
    logger.info(f"🔑 User '{user_dict['username']}' (id={user_dict['id']}) logged in successfully.")
    return {"status": "ok", "user": user_dict}

@app.post("/api/auth/register")
def register(req: UserRegisterRequest):
    conn = get_db()
    cursor = conn.cursor()

    login_clean = req.login.strip()
    if not login_clean:
        raise HTTPException(status_code=400, detail="Логин не может быть пустым")

    # Check if already exists
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (login_clean, login_clean))
    if cursor.fetchone():
        logger.warning(f"Registration conflict: username '{login_clean}' already taken.")
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    now_iso = datetime.now(timezone.utc).isoformat()
    pwd_hash = hash_password(req.password)
    email = login_clean if "@" in login_clean else f"{login_clean}@lexicards.io"
    name = req.name or login_clean

    cursor.execute("""
    INSERT INTO users (username, email, password_hash, name, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (login_clean, email, pwd_hash, name, now_iso))
    user_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    new_user = cursor.fetchone()
    conn.close()

    user_dict = row_to_user(new_user)
    logger.info(f"✨ New user registered: '{login_clean}' (id={user_id})")
    return {"status": "ok", "user": user_dict}

# ==============================================================================
# GEMINI CARD PREVIEW & REFINEMENT
# ==============================================================================

@app.post("/api/cards/preview")
async def create_card_preview(req: GeneratePreviewRequest):
    """
    Queries Google GenAI (Gemini) to generate or refine a card preview without storing it in the database.
    Requires an authenticated user.
    """
    if not req.user_id:
        logger.warning(f"🔒 Unauthorized preview request rejected for word='{req.word}'")
        raise HTTPException(
            status_code=401,
            detail="Генерация карточек через ИИ доступна только авторизованным пользователям. Пожалуйста, войдите в аккаунт."
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE id = ?", (req.user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден. Пожалуйста, войдите в аккаунт.")

    if not req.word.strip():
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    logger.info(f"📝 Preview requested by '{user['username']}' (id={user['id']}) for word='{req.word}' | Refinement={'yes' if req.feedback else 'none'}")
    preview_card = await generate_word_card_preview(
        word=req.word,
        feedback=req.feedback,
        previous_card=req.previous_card
    )
    return {"status": "ok", "card": preview_card}

@app.post("/api/cards/preview-batch")
async def create_batch_card_previews(req: GenerateBatchPreviewRequest):
    """
    Queries Google GenAI (Gemini) or LLM to generate cards for a batch of words in a single optimized prompt.
    Saves AI tokens and reduces network round-trips.
    Requires an authenticated user.
    """
    if not req.user_id:
        logger.warning("🔒 Unauthorized batch preview request rejected")
        raise HTTPException(
            status_code=401,
            detail="Пакетная генерация карточек через ИИ доступна только авторизованным пользователям. Пожалуйста, войдите в аккаунт."
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE id = ?", (req.user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден. Пожалуйста, войдите в аккаунт.")

    words = [w.strip() for w in req.words if w and w.strip()]
    if not words:
        raise HTTPException(status_code=400, detail="Words list cannot be empty")

    logger.info(f"⚡ Batch preview requested by '{user['username']}' (id={user['id']}) for {len(words)} words: {words}")
    cards = await generate_word_cards_batch(words=words)
    return {"status": "ok", "cards": cards}

# ==============================================================================
# VOCABULARY CARDS (CRUD & SRS)
# ==============================================================================

@app.get("/api/cards")
def get_user_cards(
    user_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    if user_id is None:
        return []

    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM cards WHERE user_id = ?"
    params = [user_id]

    if category and category != "all":
        query += " AND category = ?"
        params.append(category)

    if search:
        query += " AND (word LIKE ? OR translation LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cards = [row_to_card(r) for r in rows]
    conn.close()
    return cards

@app.get("/api/cards/due")
def get_due_cards(user_id: Optional[int] = Query(None)):
    if user_id is None:
        return []

    conn = get_db()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    query = "SELECT * FROM cards WHERE user_id = ? AND (due_date <= ? OR state = 'new')"
    params = [user_id, now_iso]

    query += " ORDER BY due_date ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cards = [row_to_card(r) for r in rows]
    conn.close()
    return cards

@app.post("/api/cards")
def save_confirmed_card(card: WordCardCreate):
    """
    Saves a user-accepted card into SQLite database.
    Requires an authenticated user.
    """
    if not card.user_id:
        raise HTTPException(
            status_code=401,
            detail="Сохранение карточек доступно только авторизованным пользователям. Пожалуйста, войдите в аккаунт."
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (card.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=401, detail="Пользователь не найден.")

    uid = card.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_word = card.word.strip()
    cursor.execute("SELECT id FROM cards WHERE user_id = ? AND LOWER(TRIM(word)) = LOWER(?)", (uid, clean_word))
    existing = cursor.fetchone()

    if existing:
        card_id = existing[0]
        cursor.execute("""
        UPDATE cards SET
            transcription = ?, part_of_speech = ?, category = ?, cefr_level = ?,
            frequency = ?, relevance = ?, translation = ?, definition_en = ?,
            examples = ?, collocations = ?, dictionary_source = ?
        WHERE id = ?
        """, (
            card.transcription,
            card.part_of_speech,
            card.category,
            card.cefr_level,
            card.frequency,
            card.relevance,
            card.translation,
            card.definition_en,
            json.dumps(card.examples, ensure_ascii=False),
            json.dumps(card.collocations, ensure_ascii=False),
            card.dictionary_source,
            card_id
        ))
        conn.commit()
        logger.info(f"🔄 Card updated in database: id={card_id}, word='{card.word}', user_id={uid}")
    else:
        cursor.execute("""
        INSERT INTO cards (
            user_id, word, transcription, part_of_speech, category, cefr_level,
            frequency, relevance, translation, definition_en,
            examples, collocations, dictionary_source, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            uid,
            card.word.strip(),
            card.transcription,
            card.part_of_speech,
            card.category,
            card.cefr_level,
            card.frequency,
            card.relevance,
            card.translation,
            card.definition_en,
            json.dumps(card.examples, ensure_ascii=False),
            json.dumps(card.collocations, ensure_ascii=False),
            card.dictionary_source,
            now_iso
        ))
        card_id = cursor.lastrowid
        conn.commit()
        logger.info(f"💾 Card saved to database: id={card_id}, word='{card.word}', user_id={uid}")

    cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
    row = cursor.fetchone()
    conn.close()
    return row_to_card(row)

@app.post("/api/cards/batch")
def save_confirmed_cards_batch(batch: BatchCardsCreate):
    """
    Saves multiple user-accepted cards in bulk into SQLite in a single transaction.
    Requires an authenticated user.
    """
    if not batch.user_id:
        raise HTTPException(
            status_code=401,
            detail="Сохранение карточек доступно только авторизованным пользователям. Пожалуйста, войдите в аккаунт."
        )

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (batch.user_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=401, detail="Пользователь не найден.")

    uid = batch.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    saved_cards = []

    for card in batch.cards:
        clean_word = card.word.strip()
        if not clean_word:
            continue

        cursor.execute("SELECT id FROM cards WHERE user_id = ? AND LOWER(TRIM(word)) = LOWER(?)", (uid, clean_word))
        existing = cursor.fetchone()

        if existing:
            card_id = existing[0]
            cursor.execute("""
            UPDATE cards SET
                transcription = ?, part_of_speech = ?, category = ?, cefr_level = ?,
                frequency = ?, relevance = ?, translation = ?, definition_en = ?,
                examples = ?, collocations = ?, dictionary_source = ?
            WHERE id = ?
            """, (
                card.transcription,
                card.part_of_speech,
                card.category,
                card.cefr_level,
                card.frequency,
                card.relevance,
                card.translation,
                card.definition_en,
                json.dumps(card.examples, ensure_ascii=False),
                json.dumps(card.collocations, ensure_ascii=False),
                card.dictionary_source,
                card_id
            ))
        else:
            cursor.execute("""
            INSERT INTO cards (
                user_id, word, transcription, part_of_speech, category, cefr_level,
                frequency, relevance, translation, definition_en,
                examples, collocations, dictionary_source, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                uid,
                clean_word,
                card.transcription,
                card.part_of_speech,
                card.category,
                card.cefr_level,
                card.frequency,
                card.relevance,
                card.translation,
                card.definition_en,
                json.dumps(card.examples, ensure_ascii=False),
                json.dumps(card.collocations, ensure_ascii=False),
                card.dictionary_source,
                now_iso
            ))
            card_id = cursor.lastrowid

        cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
        row = cursor.fetchone()
        if row:
            saved_cards.append(row_to_card(row))

    conn.commit()
    conn.close()
    logger.info(f"💾 Batch saved {len(saved_cards)} cards for user_id={uid}")
    return {"status": "ok", "saved_count": len(saved_cards), "cards": saved_cards}

@app.delete("/api/cards/{card_id}")
def delete_card(card_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    conn.commit()
    conn.close()
    logger.info(f"🗑️ Card deleted: id={card_id}")
    return {"status": "ok", "deleted_id": card_id}

@app.post("/api/cards/{card_id}/review")
def review_card(card_id: int, req: ReviewRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        logger.warning(f"Review attempt on non-existent card id={card_id}")
        raise HTTPException(status_code=404, detail="Card not found")

    current_card = row_to_card(row)
    updated_fields = calculate_review(current_card, req.rating)

    cursor.execute("""
    UPDATE cards SET
        interval_days = ?,
        ease_factor = ?,
        repetition_count = ?,
        due_date = ?,
        state = ?,
        last_reviewed = ?
    WHERE id = ?
    """, (
        updated_fields["interval_days"],
        updated_fields["ease_factor"],
        updated_fields["repetition_count"],
        updated_fields["due_date"],
        updated_fields["state"],
        updated_fields["last_reviewed"],
        card_id
    ))
    conn.commit()

    cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id,))
    updated_row = cursor.fetchone()
    conn.close()

    logger.info(
        f"📊 SRS Review: card id={card_id} ('{current_card['word']}'), rating='{req.rating}', "
        f"new state='{updated_fields['state']}', interval={updated_fields['interval_days']}d"
    )
    return row_to_card(updated_row)
