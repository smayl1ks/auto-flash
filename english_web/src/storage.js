// LocalStorage manager for cards and study progress
import { PRESET_CARDS } from './ai.js';

const STORAGE_KEY = 'lexicards_web_data_v1';

class StorageManager {
  constructor() {
    this.cards = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
    return [];
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cards));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  seedStarterCards() {
    this.cards = Object.values(PRESET_CARDS).map((c, idx) => ({
      ...c,
      id: String(idx + 1),
      dueDate: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // Due now
      intervalDays: 0,
      easeFactor: 2.5,
      repetitionCount: 0,
      state: 'new'
    }));
    this.save();
  }

  getDueCards(category = 'all') {
    const now = new Date();
    return this.cards.filter(c => {
      const matchCat = category === 'all' || c.category === category;
      const isDue = !c.dueDate || new Date(c.dueDate) <= now || c.state === 'new';
      return matchCat && isDue;
    });
  }

  getCategories() {
    const set = new Set(['all']);
    this.cards.forEach(c => set.add(c.category || 'general'));
    return Array.from(set);
  }

  addCard(card) {
    const existingIndex = this.cards.findIndex(c => c.word.toLowerCase() === card.word.toLowerCase());
    const cardData = {
      id: card.id || String(Date.now()),
      dueDate: new Date().toISOString(),
      intervalDays: 0,
      easeFactor: 2.5,
      repetitionCount: 0,
      state: 'new',
      ...card
    };

    if (existingIndex >= 0) {
      this.cards[existingIndex] = { ...this.cards[existingIndex], ...cardData };
    } else {
      this.cards.push(cardData);
    }
    this.save();
  }

  deleteCard(id) {
    this.cards = this.cards.filter(c => {
      const matchId = String(c.id) === String(id);
      const matchWord = c.word && String(id) && c.word.toLowerCase() === String(id).toLowerCase();
      return !matchId && !matchWord;
    });
    this.save();
  }
}

export const storage = new StorageManager();

