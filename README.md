# ⚡ AutoFlash

> **AutoFlash** — тренажёр английских слов и фраз методом интервальных повторений (SM-2 Spaced Repetition) с интерактивным графом знаний и генерацией карточек через ИИ.

---

## Ключевые возможности

- **SM-2 Spaced Repetition**: Алгоритм адаптивных интервальных повторений для долговременного запоминания слов.
- **Obsidian-style Knowledge Graph**: Интерактивная 2D-визуализация карты понятий, категорий и связей между словами (на базе HTML5 Canvas и силовой физики).
- **Пакетная генерация карточек через ИИ**: Добавление сразу нескольких слов (кнопка `+`, клавиша `Enter` или вставка через запятую) и генерация всех карточек в **один запрос** к ИИ (Gemini / LLM), что экономит до 70–80% токенов.
- **Словарные стандарты Oxford & Cambridge**: Транскрипция IPA, уровень CEFR (A1–C2), частотность, перевод, английские дефиниции, примеры и коллокации.

---

## Стек

- **Frontend**: Vanilla JavaScript (ES Modules), Tailwind CSS, Canvas API, HTML5.
- **Backend**: Python 3.11, FastAPI, Uvicorn, SQLite3, LiteLLM / Google GenAI SDK.
- **Инфраструктура**: Docker, Docker Compose, Nginx.

---

## 🚀 Быстрый запуск

### 1. Запуск через Docker (Рекомендуется)

```bash
docker compose up --build
```
Приложение будет доступно по адресу:
- **Веб-интерфейс**: [http://localhost](http://localhost) (или [http://localhost:80](http://localhost:80))
- **REST API Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Запуск в режиме разработки (Локально)

#### Бэкенд (FastAPI):
```bash
# Установка зависимостей
pip install -r english_backend/requirements.txt

# Запуск сервера
npm run dev:backend
# или: python -m uvicorn main:app --app-dir english_backend --host 0.0.0.0 --port 8000 --reload
```

#### Фронтенд (Vite & Tailwind):
```bash
# Установка зависимостей
npm install

# Сборка CSS и запуск dev-сервера
npm run dev
```

---

## Переменные окружения (.env)

Создайте файл `.env` в корне проекта:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(При отсутствии ключа автоматически задействуется встроенный офлайн-генератор и база готовых кембриджских карточек).*
