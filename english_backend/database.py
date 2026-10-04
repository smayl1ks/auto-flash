import sqlite3
import json
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_FILE = "lexicards.db"

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # Cards table with user_id
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        word TEXT NOT NULL,
        transcription TEXT,
        part_of_speech TEXT,
        category TEXT,
        cefr_level TEXT,
        frequency TEXT,
        relevance TEXT,
        translation TEXT NOT NULL,
        definition_en TEXT,
        examples TEXT, -- JSON array
        collocations TEXT, -- JSON array
        dictionary_source TEXT,
        due_date TEXT NOT NULL,
        interval_days REAL DEFAULT 0,
        ease_factor REAL DEFAULT 2.5,
        repetition_count INTEGER DEFAULT 0,
        state TEXT DEFAULT 'new',
        last_reviewed TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    # Migration check: Ensure user_id exists if cards table was created in an older version
    cursor.execute("PRAGMA table_info(cards);")
    existing_columns = [col[1] for col in cursor.fetchall()]
    if existing_columns and "user_id" not in existing_columns:
        cursor.execute("ALTER TABLE cards ADD COLUMN user_id INTEGER DEFAULT 1;")
        conn.commit()

    # Seed 5 accounts if not present
    seed_test_accounts_and_cards(conn)

    # Deduplicate cards per user if any duplicates exist
    cursor.execute("""
    DELETE FROM cards
    WHERE id NOT IN (
        SELECT MAX(id)
        FROM cards
        GROUP BY user_id, LOWER(TRIM(word))
    );
    """)
    conn.commit()
    conn.close()

def seed_test_accounts_and_cards(conn: sqlite3.Connection):
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    default_pwd_hash = hash_password("password123")

    test_users = [
        {"username": "smayl1ks", "email": "smayl1ks@lexicards.io", "name": "smayl1ks"},
        {"username": "tonitaga", "email": "tonitaga@lexicards.io", "name": "tonitaga"},
        {"username": "antonk", "email": "antonk@lexicards.io", "name": "antonk"},
        {"username": "alex", "email": "alex@lexicards.io", "name": "alex"},
        {"username": "demo", "email": "demo@lexicards.io", "name": "demo"}
    ]

    starter_vocabulary = [
        {
            "word": "deal with",
            "transcription": "/diːl wɪð/",
            "part_of_speech": "phrasal verb",
            "category": "phrasal_verbs",
            "cefr_level": "B1",
            "frequency": "9/10",
            "relevance": "высокая, обязательное слово для активного словаря",
            "translation": "Иметь дело с, заниматься, справляться с",
            "definition_en": "to take action in order to achieve something or in order to solve a problem",
            "examples": [
                "I have a lot of paperwork to <b>deal with</b> today.",
                "He knows how to <b>deal with</b> difficult customers.",
                "The government must <b>deal with</b> unemployment immediately."
            ],
            "collocations": ["deal with a problem", "deal with difficult customers", "deal with stress"],
            "dictionary_source": "Cambridge Advanced Learner's Dictionary",
            "state": "review",
            "interval_days": 4.0,
            "repetition_count": 2
        },
        {
            "word": "look forward to",
            "transcription": "/lʊk ˈfɔːwəd tuː/",
            "part_of_speech": "phrasal verb",
            "category": "phrasal_verbs",
            "cefr_level": "B1",
            "frequency": "10/10",
            "relevance": "крайне высокая, стандарт вежливого делового общения",
            "translation": "С нетерпением ждать, предвкушать",
            "definition_en": "to feel pleased and excited about something that is going to happen",
            "examples": [
                "I am really <b>looking forward to</b> my vacation next week.",
                "We <b>look forward to</b> hearing from you soon."
            ],
            "collocations": ["look forward to meeting you", "look forward to the weekend"],
            "dictionary_source": "Cambridge Advanced Learner's Dictionary",
            "state": "mastered",
            "interval_days": 24.0,
            "repetition_count": 5
        },
        {
            "word": "resilient",
            "transcription": "/rɪˈzɪliənt/",
            "part_of_speech": "adjective",
            "category": "psychology_and_character",
            "cefr_level": "C1",
            "frequency": "8/10",
            "relevance": "высокая, часто встречается в бизнес-литературе и подкастах",
            "translation": "Стойкий, жизнестойкий, неунывающий",
            "definition_en": "able to quickly return to a previous good condition after problems or illness",
            "examples": [
                "The company remained remarkably <b>resilient</b> despite the crisis.",
                "Children are often surprisingly <b>resilient</b>."
            ],
            "collocations": ["highly resilient", "resilient economy", "resilient mindset"],
            "dictionary_source": "Cambridge Advanced Learner's Dictionary",
            "state": "learning",
            "interval_days": 1.0,
            "repetition_count": 1
        },
        {
            "word": "take for granted",
            "transcription": "/teɪk fɔː ˈɡrɑːntɪd/",
            "part_of_speech": "idiom",
            "category": "idioms",
            "cefr_level": "B2",
            "frequency": "8/10",
            "relevance": "высокая, популярная идиома в повседневной речи",
            "translation": "Принимать как должное, не ценить",
            "definition_en": "to never think about something because you believe it will always be available or true",
            "examples": [
                "Most of us <b>take</b> clean water <b>for granted</b>.",
                "Do not <b>take</b> your health <b>for granted</b>."
            ],
            "collocations": ["take someone for granted", "take life for granted"],
            "dictionary_source": "Oxford Advanced Learner's Dictionary",
            "state": "new",
            "interval_days": 0.0,
            "repetition_count": 0
        },
        {
            "word": "come up with",
            "transcription": "/kʌm ʌp wɪð/",
            "part_of_speech": "phrasal verb",
            "category": "phrasal_verbs",
            "cefr_level": "B1",
            "frequency": "9/10",
            "relevance": "крайне высокая, постоянно используется в брейншторминге",
            "translation": "Придумывать, предлагать идею или решение",
            "definition_en": "to suggest or think of an idea or plan",
            "examples": [
                "She <b>came up with</b> a great idea for the project.",
                "We need to <b>come up with</b> a solution quickly."
            ],
            "collocations": ["come up with an idea", "come up with a plan", "come up with a solution"],
            "dictionary_source": "Cambridge Advanced Learner's Dictionary",
            "state": "review",
            "interval_days": 6.0,
            "repetition_count": 3
        }
    ]

    for user_info in test_users:
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (user_info["username"], user_info["email"]))
        existing = cursor.fetchone()
        if not existing:
            cursor.execute("""
            INSERT INTO users (username, email, password_hash, name, created_at)
            VALUES (?, ?, ?, ?, ?)
            """, (user_info["username"], user_info["email"], default_pwd_hash, user_info["name"], now_iso))
            user_id = cursor.lastrowid

            # Add starter cards to smayl1ks, tonitaga, antonk, alex (demo user gets fresh empty vocabulary)
            if user_info["username"] != "demo":
                for card in starter_vocabulary:
                    cursor.execute("""
                    INSERT INTO cards (
                        user_id, word, transcription, part_of_speech, category, cefr_level,
                        frequency, relevance, translation, definition_en,
                        examples, collocations, dictionary_source, due_date,
                        interval_days, repetition_count, state
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        user_id,
                        card["word"],
                        card["transcription"],
                        card["part_of_speech"],
                        card["category"],
                        card["cefr_level"],
                        card["frequency"],
                        card["relevance"],
                        card["translation"],
                        card["definition_en"],
                        json.dumps(card["examples"], ensure_ascii=False),
                        json.dumps(card["collocations"], ensure_ascii=False),
                        card["dictionary_source"],
                        now_iso,
                        card.get("interval_days", 0),
                        card.get("repetition_count", 0),
                        card.get("state", "new")
                    ))
    conn.commit()

def row_to_card(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d["examples"] = json.loads(d["examples"]) if d.get("examples") else []
    d["collocations"] = json.loads(d["collocations"]) if d.get("collocations") else []
    return d

def row_to_user(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d.pop("password_hash", None)
    return d
