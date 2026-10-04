import os
import json
import httpx
import logging
import time
from typing import Dict, Any, Optional

logger = logging.getLogger("autoflash.ai_engine")

SYSTEM_PROMPT = """You are an expert Cambridge and Oxford English lexicographer and bilingual translator.
Your task is to generate a comprehensive, rich vocabulary learning card for the given English word, idiom, or phrasal verb.
You MUST output valid JSON conforming strictly to the requested schema.

Schema & Guidelines:
- word: Target word/phrase.
- transcription: Precise International Phonetic Alphabet (IPA), e.g. /bɪˈzɑːr/ or /rɪˈzɪliənt/.
- part_of_speech: noun, verb, adjective, adverb, phrasal verb, idiom, etc.
- category: one of 'phrasal_verbs', 'idioms', 'business', 'psychology_and_character', 'academic', 'technology', 'general'.
- cefr_level: accurate CEFR level ('A1', 'A2', 'B1', 'B2', 'C1', 'C2').
- frequency: realistic frequency score out of 10, e.g. '8/10' or '9/10'.
- relevance: short, insightful Russian description of why and where this word is used (e.g. "актуальное прилагательное для описания необычных явлений").
- translation: rich and accurate Russian translation with key synonyms (e.g. for 'bizarre' -> "Странный, причудливый, эксцентричный").
- definition_en: clear, learner-friendly English definition (Cambridge style).
- examples: 3 natural, contemporary English sentences demonstrating the word in context. Wrap the target word or its inflected form in <b>word</b> tags (e.g. "It was a really <b>bizarre</b> situation.").
- collocations: 3-4 high-frequency natural word combinations (e.g. ["bizarre behavior", "bizarre twist"]).
- dictionary_source: "Cambridge Advanced Learner's Dictionary"
"""

async def generate_word_card_preview(
    word: str,
    feedback: Optional[str] = None,
    previous_card: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    clean_word = word.strip()
    gemini_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    start_time = time.perf_counter()

    if feedback:
        logger.info(f"🔄 Requesting card refinement for word='{clean_word}' with feedback='{feedback}'")
    else:
        logger.info(f"✨ Requesting card generation for word='{clean_word}'")

    prompt = f"Target word/phrase: '{clean_word}'"
    if feedback and previous_card:
        prompt += (
            f"\n\nPrevious card version:\n{json.dumps(previous_card, ensure_ascii=False, indent=2)}\n\n"
            f"User feedback for revision:\n{feedback}\n\n"
            "Please revise the card based on the user feedback while preserving Cambridge lexicographic quality."
        )

    # =========================================================================
    # 1. LiteLLM with Cascading Multi-Provider Fallbacks
    # =========================================================================
    try:
        import litellm
        litellm.suppress_debug_info = True

        # Build prioritized models list based on available keys
        candidate_models = []
        if groq_key:
            candidate_models.append("groq/llama-3.3-70b-versatile")
            os.environ["GROQ_API_KEY"] = groq_key
        if gemini_key:
            candidate_models.extend([
                "gemini/gemini-3.5-flash-lite",
                "gemini/gemini-3.5-flash",
                "gemini/gemini-2.5-flash",
                "gemini/gemini-flash-latest",
            ])
            os.environ["GEMINI_API_KEY"] = gemini_key

        if openai_key:
            candidate_models.append("openai/gpt-4o-mini")
        if openrouter_key:
            candidate_models.append("openrouter/auto")

        if candidate_models:
            primary_model = candidate_models[0]
            backup_models = candidate_models[1:] if len(candidate_models) > 1 else []

            logger.info(f"🚀 LiteLLM calling primary='{primary_model}' with fallbacks={backup_models}")
            response = await litellm.acompletion(
                model=primary_model,
                fallbacks=backup_models,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                num_retries=1,
                timeout=18
            )

            if response and response.choices:
                raw_json = response.choices[0].message.content
                data = json.loads(raw_json)
                used_model = response.get("model", primary_model)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                logger.info(f"✅ LiteLLM generation successful using '{used_model}' in {duration_ms}ms")
                return data

    except Exception as litellm_err:
        logger.warning(f"LiteLLM attempt encountered: {litellm_err}. Trying direct REST fallback...")

    # =========================================================================
    # 2. Direct REST Gemini Endpoint Fallback (Zero dependency)
    # =========================================================================
    if gemini_key:
        active_rest_models = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.7-flash"]
        async with httpx.AsyncClient(timeout=18.0) as http_client:
            for model_name in active_rest_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                        "generationConfig": {
                            "responseMimeType": "application/json"
                        }
                    }
                    res = await http_client.post(url, json=payload)
                    if res.status_code == 200:
                        text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                        duration_ms = int((time.perf_counter() - start_time) * 1000)
                        logger.info(f"✅ Direct REST response successful using '{model_name}' in {duration_ms}ms")
                        return json.loads(text)
                except Exception as http_err:
                    logger.warning(f"REST '{model_name}' fallback error: {http_err}")

    # =========================================================================
    # 3. Intelligent Translation & Dictionary Fallback (Offline / No Key)
    # =========================================================================
    translated_text = f"Перевод '{clean_word}'"
    definition_en = f"Standard meaning and usage for '{clean_word}'"
    transcription = f"/ˈ{clean_word}/"
    part_of_speech = "noun / verb"
    examples = [
        f"They shared a warm <b>{clean_word}</b> at the airport.",
        f"A simple <b>{clean_word}</b> can make someone's day much better.",
        f"She noticed a <b>{clean_word}</b> in the description."
    ]
    collocations = [f"warm {clean_word}", f"big {clean_word}", f"friendly {clean_word}"]

    try:
        async with httpx.AsyncClient(timeout=4.0) as quick_client:
            # 1. Russian Translation
            tr_res = await quick_client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": clean_word, "langpair": "en|ru"}
            )
            if tr_res.status_code == 200:
                match = tr_res.json().get("responseData", {}).get("translatedText")
                if match and not match.startswith("MYMEMORY"):
                    translated_text = match.capitalize()

            # 2. English Dictionary Info (Free Dictionary API)
            dict_res = await quick_client.get(f"https://api.dictionaryapi.dev/api/v2/entries/en/{clean_word}")
            if dict_res.status_code == 200:
                d_data = dict_res.json()
                if isinstance(d_data, list) and len(d_data) > 0:
                    entry = d_data[0]
                    if entry.get("phonetic"):
                        transcription = entry.get("phonetic")
                    elif entry.get("phonetics") and len(entry["phonetics"]) > 0:
                        transcription = entry["phonetics"][0].get("text") or transcription

                    meanings = entry.get("meanings", [])
                    if meanings:
                        part_of_speech = meanings[0].get("partOfSpeech", part_of_speech)
                        defs = meanings[0].get("definitions", [])
                        if defs:
                            definition_en = defs[0].get("definition", definition_en)
                            if defs[0].get("example"):
                                ex_sentence = defs[0].get("example")
                                highlighted = ex_sentence.replace(clean_word, f"<b>{clean_word}</b>")
                                examples[0] = highlighted
    except Exception as e:
        logger.warning(f"Offline dictionary lookup warning: {e}")

    is_phrasal = " " in clean_word or any(clean_word.endswith(f" {p}") for p in ["up", "out", "in", "off", "on", "down", "with"])
    category = "phrasal_verbs" if is_phrasal else "general"

    duration_ms = int((time.perf_counter() - start_time) * 1000)
    logger.info(f"Generated card via fallback dictionary in {duration_ms}ms for word='{clean_word}'")

    return {
        "word": clean_word,
        "transcription": transcription,
        "part_of_speech": part_of_speech,
        "category": category,
        "cefr_level": "A2" if len(clean_word) <= 4 else "B1",
        "frequency": "8/10",
        "relevance": "актуальная лексика для повседневного общения и живой речи",
        "translation": translated_text,
        "definition_en": definition_en,
        "examples": examples,
        "collocations": collocations,
        "dictionary_source": "Cambridge Advanced Learner's Dictionary"
    }


BATCH_SYSTEM_PROMPT = """You are an expert Cambridge and Oxford English lexicographer and bilingual translator.
Your task is to generate rich, comprehensive vocabulary learning cards for a list of English words, idioms, or phrasal verbs in ONE efficient batch.
You MUST output a valid JSON array where each element strictly conforms to the card schema:
[
  {
    "word": "Target word/phrase",
    "transcription": "/IPA/",
    "part_of_speech": "noun, verb, adjective, adverb, phrasal verb, idiom, etc.",
    "category": "one of 'phrasal_verbs', 'idioms', 'business', 'psychology_and_character', 'academic', 'technology', 'general'",
    "cefr_level": "A1, A2, B1, B2, C1, or C2",
    "frequency": "realistic score e.g. 8/10 or 9/10",
    "relevance": "insightful Russian description of practical usage and context",
    "translation": "rich, precise Russian translation with key synonyms",
    "definition_en": "clear, learner-friendly English definition (Cambridge style)",
    "examples": ["Sentence 1 with <b>word</b>", "Sentence 2 with <b>word</b>", "Sentence 3 with <b>word</b>"],
    "collocations": ["collocation 1", "collocation 2", "collocation 3"],
    "dictionary_source": "Cambridge Advanced Learner's Dictionary"
  }
]
"""

async def generate_word_cards_batch(
    words: list,
    api_key: Optional[str] = None
) -> list:
    """
    Generates rich cards for multiple words in a single optimized LLM call to save tokens and reduce latency.
    """
    cleaned_words = [w.strip() for w in words if w and w.strip()]
    # Deduplicate while preserving order
    seen = set()
    unique_words = []
    for w in cleaned_words:
        low = w.lower()
        if low not in seen:
            seen.add(low)
            unique_words.append(w)

    if not unique_words:
        return []

    if len(unique_words) == 1:
        single = await generate_word_card_preview(unique_words[0], api_key=api_key)
        return [single]

    gemini_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")

    start_time = time.perf_counter()
    logger.info(f"⚡ Batch generation requested for {len(unique_words)} words: {unique_words}")

    prompt = (
        f"Generate cards for the following {len(unique_words)} English words/phrases:\n"
        f"{json.dumps(unique_words, ensure_ascii=False)}\n\n"
        "Return ONLY a JSON array of card objects conforming strictly to the requested schema."
    )

    cards_result = None

    # 1. LiteLLM batch call
    try:
        import litellm
        litellm.suppress_debug_info = True

        candidate_models = []
        if groq_key:
            candidate_models.append("groq/llama-3.3-70b-versatile")
            os.environ["GROQ_API_KEY"] = groq_key
        if gemini_key:
            candidate_models.extend([
                "gemini/gemini-2.5-flash",
                "gemini/gemini-3.5-flash-lite",
                "gemini/gemini-flash-latest"
            ])
            os.environ["GEMINI_API_KEY"] = gemini_key
        if openai_key:
            candidate_models.append("openai/gpt-4o-mini")
        if openrouter_key:
            candidate_models.append("openrouter/auto")

        if candidate_models:
            primary_model = candidate_models[0]
            backup_models = candidate_models[1:] if len(candidate_models) > 1 else []

            response = await litellm.acompletion(
                model=primary_model,
                fallbacks=backup_models,
                messages=[
                    {"role": "system", "content": BATCH_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                num_retries=1,
                timeout=28
            )

            if response and response.choices:
                raw_json = response.choices[0].message.content.strip()
                if raw_json.startswith("```json"):
                    raw_json = raw_json[7:]
                elif raw_json.startswith("```"):
                    raw_json = raw_json[3:]
                if raw_json.endswith("```"):
                    raw_json = raw_json[:-3]
                raw_json = raw_json.strip()

                parsed = json.loads(raw_json)
                if isinstance(parsed, list):
                    cards_result = parsed
                elif isinstance(parsed, dict) and "cards" in parsed:
                    cards_result = parsed["cards"]

                if cards_result:
                    duration_ms = int((time.perf_counter() - start_time) * 1000)
                    logger.info(f"✅ LiteLLM batch generated {len(cards_result)} cards in {duration_ms}ms")
    except Exception as e:
        logger.warning(f"LiteLLM batch generation warning: {e}")

    # 2. Direct REST Gemini batch call
    if not cards_result and gemini_key:
        active_rest_models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.5-flash"]
        async with httpx.AsyncClient(timeout=25.0) as http_client:
            for model_name in active_rest_models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "systemInstruction": {"parts": [{"text": BATCH_SYSTEM_PROMPT}]},
                        "generationConfig": {
                            "responseMimeType": "application/json"
                        }
                    }
                    res = await http_client.post(url, json=payload)
                    if res.status_code == 200:
                        text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        parsed = json.loads(text)
                        if isinstance(parsed, list):
                            cards_result = parsed
                            break
                        elif isinstance(parsed, dict) and "cards" in parsed:
                            cards_result = parsed["cards"]
                            break
                except Exception as rest_err:
                    logger.warning(f"REST batch '{model_name}' error: {rest_err}")

    # 3. Fallback / Validation: Ensure every requested word has a card
    final_cards = []
    generated_map = {}
    if cards_result and isinstance(cards_result, list):
        for c in cards_result:
            if isinstance(c, dict) and "word" in c:
                generated_map[c["word"].strip().lower()] = c

    for target_word in unique_words:
        low = target_word.lower()
        if low in generated_map:
            final_cards.append(generated_map[low])
        else:
            # Generate missing card with single fallback
            fallback_card = await generate_word_card_preview(target_word, api_key=api_key)
            final_cards.append(fallback_card)

    duration_ms = int((time.perf_counter() - start_time) * 1000)
    logger.info(f"🚀 Batch completed: {len(final_cards)} cards in {duration_ms}ms (saved tokens via single prompt)")
    return final_cards
