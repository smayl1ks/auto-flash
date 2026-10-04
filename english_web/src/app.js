import { storage } from './storage.js';
import { processReview, formatInterval, SRS_RATINGS } from './srs.js';
import { generateCardData, generateBatchCardsData } from './ai.js';
import { triggerConfetti } from './confetti.js';
import { ObsidianWordGraph } from './graph.js';

const API_BASE = (window.location.port === '8000' ? '' : (window.location.port === '80' || window.location.port === '' ? '' : 'http://localhost:8000')) + '/api';

class LexiSimpleApp {
  constructor() {
    this.currentTab = 'home';
    this.studyQueue = [];
    this.studyIndex = 0;
    this.sessionReviewedCount = 0;
    this.isRevealed = false;
    this.activeCategory = 'all';
    this.isBackendOnline = false;
    this.currentWotd = null;

    this.initElements();
    if (!this.currentUser && (!storage.cards || storage.cards.length === 0)) {
      storage.seedStarterCards();
    }
    this.initGraph();
    this.bindEvents();
    this.checkBackendHealth();
    this.renderHome();
  }

  initElements() {
    // Nav Tabs & Views
    this.navTabs = document.querySelectorAll('.nav-tab');
    this.viewSections = document.querySelectorAll('.view-section');
    this.headerDueBadges = document.querySelectorAll('.badge-due');
    this.btnOpenAiGenerator = document.getElementById('btn-open-ai-generator');

    // Home elements
    this.minimalStartBlock = document.querySelector('.minimal-start-block');
    this.heroDueTitle = document.getElementById('hero-due-title');
    this.heroStatusPill = document.getElementById('hero-status-pill');
    this.btnStartStudyHero = document.getElementById('btn-start-study-hero');
    this.btnQuickBlitz = document.getElementById('btn-quick-blitz');
    this.metricTotalWords = document.getElementById('metric-total-words');
    this.metricDueCount = document.getElementById('metric-due-count');
    this.metricLearningCount = document.getElementById('metric-learning-count');
    this.metricMastered = document.getElementById('metric-mastered');

    // Segments & Retention
    this.segMastered = document.getElementById('seg-mastered');
    this.segReview = document.getElementById('seg-review');
    this.segLearning = document.getElementById('seg-learning');
    this.segNew = document.getElementById('seg-new');
    this.retentionPercentText = document.getElementById('retention-percent-text');

    // Streak & Daily Target
    this.userStreakDays = document.getElementById('user-streak-days');
    this.dailyTargetText = document.getElementById('daily-target-text');
    this.dailyTargetBar = document.getElementById('daily-target-bar');

    // Graph mount & info
    this.graphRoot = document.getElementById('obsidian-graph-root');
    this.graphNodeCount = document.getElementById('graph-node-count');

    // Word of the Day
    this.wotdWord = document.getElementById('wotd-word');
    this.wotdIpa = document.getElementById('wotd-ipa');
    this.wotdCefr = document.getElementById('wotd-cefr');
    this.wotdTranslation = document.getElementById('wotd-translation');
    this.wotdExample = document.getElementById('wotd-example');
    this.btnWotdSpeak = document.getElementById('btn-wotd-speak');
    this.btnWotdTrain = document.getElementById('btn-wotd-train');
    this.cefrBarsList = document.getElementById('cefr-bars-list');

    // Study elements
    this.studyEmptyWrapper = document.getElementById('study-empty-wrapper');
    this.btnStudyAddWord = document.getElementById('btn-study-add-word');
    this.studyActiveWrapper = document.querySelector('.study-wrapper');
    this.studyCompleteWrapper = document.getElementById('study-complete-wrapper');
    this.studyConfettiCanvas = document.getElementById('study-confetti-canvas');
    this.completeReviewedCount = document.getElementById('complete-reviewed-count');
    this.completeRemainingCount = document.getElementById('complete-remaining-count');
    this.btnCompleteHome = document.getElementById('btn-complete-home');
    this.btnCompleteRestart = document.getElementById('btn-complete-restart');

    this.studyProgressCounter = document.getElementById('study-progress-counter');
    this.studyCardWord = document.getElementById('study-card-word');
    this.studyCardTranscription = document.getElementById('study-card-transcription');
    this.btnStudyClose = document.getElementById('btn-study-close');
    this.studyExamplesList = document.getElementById('study-examples-list');
    this.studyAnswerPart = document.getElementById('study-answer-part');
    this.studyCardTranslation = document.getElementById('study-card-translation');
    this.studyCardCefr = document.getElementById('study-card-cefr');
    this.studyCardFreq = document.getElementById('study-card-freq');
    this.studyCardRelevance = document.getElementById('study-card-relevance');
    this.studyCollocationsWrapper = document.getElementById('study-collocations-wrapper');
    this.studyCollocationsChips = document.getElementById('study-collocations-chips');
    this.btnShowAnswer = document.getElementById('btn-show-answer');
    this.srsIntervalsDeck = document.getElementById('srs-intervals-deck');

    // Dictionary list elements
    this.dictSearchInput = document.getElementById('dict-search-input');
    this.dictListBody = document.getElementById('dict-list-body');
    this.dictTotalCount = document.getElementById('dict-total-count');

    // AI Modal Elements
    this.modalAi = document.getElementById('modal-ai');
    this.btnCloseAi = document.getElementById('btn-close-ai');
    this.aiModalHeading = document.getElementById('ai-modal-heading');
    this.aiStepInput = document.getElementById('ai-step-input');
    this.aiStepPreview = document.getElementById('ai-step-preview');
    this.aiInputWord = document.getElementById('ai-input-word');
    this.btnSubmitAiGen = document.getElementById('btn-submit-ai-gen');
    this.btnSubmitAiText = document.getElementById('btn-submit-ai-text');
    this.aiBatchTagsContainer = document.getElementById('ai-batch-tags-container');
    this.btnAddWordChip = document.getElementById('btn-add-word-chip');
    this.aiBatchTabs = document.getElementById('ai-batch-tabs');
    this.previewCardCounter = document.getElementById('preview-card-counter');
    this.btnAcceptText = document.getElementById('btn-accept-text');

    this.batchWords = [];
    this.generatedBatchCards = [];
    this.batchPreviewIndex = 0;

    // AI Preview fields
    this.previewWord = document.getElementById('preview-word');
    this.previewTranscription = document.getElementById('preview-transcription');
    this.previewCefr = document.getElementById('preview-cefr');
    this.previewTranslation = document.getElementById('preview-translation');
    this.previewDefinition = document.getElementById('preview-definition');
    this.previewExamplesList = document.getElementById('preview-examples-list');
    this.previewCollocationsList = document.getElementById('preview-collocations-list');
    this.aiRefineBox = document.getElementById('ai-refine-box');
    this.aiInputFeedback = document.getElementById('ai-input-feedback');
    this.btnAiRefineToggle = document.getElementById('btn-ai-refine-toggle');
    this.btnSubmitAiRefine = document.getElementById('btn-submit-ai-refine');
    this.btnAiAcceptCard = document.getElementById('btn-ai-accept-card');
    this.currentGeneratedCard = null;

    // Auth Elements
    this.btnAuthHeader = document.getElementById('btn-auth-header');
    this.btnLogoutHeader = document.getElementById('btn-logout-header');
    this.modalAuth = document.getElementById('modal-auth');
    this.btnCloseAuth = document.getElementById('btn-close-auth');
    this.authTabLogin = document.getElementById('auth-tab-login');
    this.authTabRegister = document.getElementById('auth-tab-register');
    this.authModalTitle = document.getElementById('auth-modal-title');
    this.authInputEmail = document.getElementById('auth-input-email');
    this.authInputPassword = document.getElementById('auth-input-password');
    this.btnSubmitAuth = document.getElementById('btn-submit-auth');
    this.btnQuickDemoLogin = document.getElementById('btn-quick-demo-login');
    this.btnContinueGuest = document.getElementById('btn-continue-guest');
    this.demoUserChips = document.querySelectorAll('.demo-user-chip');
    this.authForm = document.getElementById('auth-form');

    this.currentUser = JSON.parse(localStorage.getItem('mnemo_user') || 'null');
    this.authMode = 'login';
    this.updateAuthUI();
  }

  updateAuthUI() {
    if (!this.btnAuthHeader) return;
    if (this.currentUser) {
      const name = this.currentUser.name || this.currentUser.username || this.currentUser.email.split('@')[0];
      this.btnAuthHeader.innerHTML = `<span>${name}</span>`;
      this.btnAuthHeader.classList.add('logged-in');
      this.btnAuthHeader.title = 'Текущий профиль';
      if (this.btnLogoutHeader) this.btnLogoutHeader.style.display = 'flex';
    } else {
      this.btnAuthHeader.innerHTML = `<span>Войти</span>`;
      this.btnAuthHeader.classList.remove('logged-in');
      this.btnAuthHeader.title = 'Войти в аккаунт';
      if (this.btnLogoutHeader) this.btnLogoutHeader.style.display = 'none';
    }
  }

  handleLogout() {
    this.currentUser = null;
    localStorage.removeItem('mnemo_user');
    storage.seedStarterCards();
    this.updateAuthUI();
    this.renderHome();
    this.renderDictionary();
  }

  async checkBackendHealth() {
    try {
      const pingUrl = API_BASE.startsWith('http') ? 'http://localhost:8000/' : `${API_BASE}/cards`;
      const res = await fetch(pingUrl, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        this.isBackendOnline = true;
        await this.syncWithBackend();
      }
    } catch (e) {
      try {
        const fallbackRes = await fetch('http://localhost:8000/', { signal: AbortSignal.timeout(1200) });
        if (fallbackRes.ok) {
          this.isBackendOnline = true;
          await this.syncWithBackend();
        }
      } catch (_) {
        this.isBackendOnline = false;
      }
    }
  }

  async syncWithBackend() {
    if (!this.currentUser || !this.currentUser.id) {
      storage.cards = [];
      storage.save();
      this.renderHome();
      this.renderDictionary();
      return;
    }

    try {
      const url = `${API_BASE}/cards?user_id=${this.currentUser.id}`;
      const res = await fetch(url);
      if (res.ok) {
        const backendCards = await res.json();
        if (Array.isArray(backendCards)) {
          storage.cards = backendCards.map(c => ({
            ...c,
            id: String(c.id),
            partOfSpeech: c.part_of_speech || c.partOfSpeech,
            cefrLevel: c.cefr_level || c.cefrLevel,
            definitionEn: c.definition_en || c.definitionEn,
            dictionarySource: c.dictionary_source || c.dictionarySource,
            dueDate: c.due_date || c.dueDate,
            intervalDays: c.interval_days || c.intervalDays,
            easeFactor: c.ease_factor || c.easeFactor,
            repetitionCount: c.repetition_count || c.repetitionCount
          }));
          storage.save();
          this.renderHome();
          this.renderDictionary();
        }
      }
    } catch (_) { }
  }

  initGraph() {
    if (this.graphRoot) {
      this.wordGraph = new ObsidianWordGraph(this.graphRoot, {
        onAddWordClick: () => this.openAiModal(),
        onNodeClick: (node) => {
          if (node && !node.isHub && node.card) {
            console.log('Obsidian node selected:', node.card.word);
          }
        }
      });
    }
  }

  bindEvents() {
    // Nav tabs
    this.navTabs.forEach(tab => {
      tab.onclick = () => {
        const target = tab.getAttribute('data-tab');
        this.switchTab(target);
      };
    });

    // Home Actions
    this.btnStartStudyHero.onclick = () => this.startStudySession();
    if (this.btnQuickBlitz) {
      this.btnQuickBlitz.onclick = () => this.startBlitzSession();
    }
    this.btnOpenAiGenerator.onclick = () => this.openAiModal();

    // Word of the Day Actions
    if (this.btnWotdSpeak) {
      this.btnWotdSpeak.onclick = () => {
        if (this.currentWotd && this.currentWotd.word) {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(this.currentWotd.word);
            u.lang = 'en-US';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
          }
        }
      };
    }

    if (this.btnWotdTrain) {
      this.btnWotdTrain.onclick = () => {
        if (this.currentWotd) {
          this.studyQueue = [this.currentWotd];
          this.studyIndex = 0;
          this.sessionReviewedCount = 0;
          this.isRevealed = false;
          if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'block';
          if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';
          this.switchTab('study');
          this.loadCard(0);
        }
      };
    }

    // Auth Button Header
    if (this.btnAuthHeader) {
      this.btnAuthHeader.onclick = () => {
        if (!this.currentUser) {
          this.openAuthModal();
        }
      };
    }
    if (this.btnLogoutHeader) {
      this.btnLogoutHeader.onclick = () => this.handleLogout();
    }

    // Auth Modal Events
    if (this.btnCloseAuth) this.btnCloseAuth.onclick = () => this.closeAuthModal();
    if (this.modalAuth) {
      this.modalAuth.onclick = (e) => {
        if (e.target === this.modalAuth) this.closeAuthModal();
      };
    }
    if (this.authTabLogin) {
      this.authTabLogin.onclick = () => this.setAuthMode('login');
    }
    if (this.authTabRegister) {
      this.authTabRegister.onclick = () => this.setAuthMode('register');
    }
    if (this.authForm) {
      this.authForm.onsubmit = (e) => {
        e.preventDefault();
        this.handleAuthSubmit();
      };
    }
    if (this.btnQuickDemoLogin) {
      this.btnQuickDemoLogin.onclick = () => {
        this.authInputEmail.value = 'demo';
        this.authInputPassword.value = 'password123';
        this.setAuthMode('login');
        this.handleAuthSubmit();
      };
    }
    if (this.btnContinueGuest) {
      this.btnContinueGuest.onclick = () => {
        this.currentUser = {
          id: 'guest',
          username: 'guest',
          name: 'Гость',
          isGuest: true
        };
        localStorage.setItem('mnemo_user', JSON.stringify(this.currentUser));
        if (!storage.cards || storage.cards.length === 0) {
          storage.seedStarterCards();
        }
        this.updateAuthUI();
        this.closeAuthModal();
        this.renderHome();
        this.renderDictionary();
      };
    }
    if (this.demoUserChips) {
      this.demoUserChips.forEach(chip => {
        chip.onclick = () => {
          const u = chip.getAttribute('data-user');
          this.authInputEmail.value = u;
          this.authInputPassword.value = 'password123';
          this.setAuthMode('login');
          this.handleAuthSubmit();
        };
      });
    }

    // Study Actions
    if (this.btnStudyAddWord) {
      this.btnStudyAddWord.onclick = () => this.openAiModal();
    }
    this.btnShowAnswer.onclick = () => this.revealAnswer();
    this.btnStudyClose.onclick = () => this.switchTab('home');

    this.srsIntervalsDeck.querySelectorAll('.srs-button-node').forEach(btn => {
      btn.onclick = () => {
        const rating = btn.getAttribute('data-rating');
        this.submitRating(rating);
      };
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.currentTab === 'study') {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!this.isRevealed) this.revealAnswer();
        } else if (this.isRevealed) {
          if (e.key === '1') this.submitRating(SRS_RATINGS.AGAIN);
          if (e.key === '2') this.submitRating(SRS_RATINGS.HARD);
          if (e.key === '3') this.submitRating(SRS_RATINGS.GOOD);
          if (e.key === '4') this.submitRating(SRS_RATINGS.EASY);
        }
      }
    });

    // Dictionary search
    this.dictSearchInput.oninput = () => this.renderDictionary();

    // AI Modal Actions
    this.btnCloseAi.onclick = () => this.closeAiModal();
    this.modalAi.onclick = (e) => {
      if (e.target === this.modalAi) this.closeAiModal();
    };
    if (this.btnAddWordChip) {
      this.btnAddWordChip.onclick = () => this.handleTagAddFromInput();
    }
    this.aiInputWord.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.aiInputWord.value.trim().length > 0) {
          this.handleTagAddFromInput();
        } else if (this.batchWords.length > 0) {
          this.handleAiGenerate();
        }
      }
      if (e.key === 'Escape') this.closeAiModal();
    };
    this.aiInputWord.oninput = () => {
      const val = this.aiInputWord.value;
      if (val.includes(',') || val.includes('\n')) {
        this.handleTagAddFromInput();
      } else {
        this.updateSubmitBtnText();
      }
    };
    this.btnSubmitAiGen.onclick = () => this.handleAiGenerate();

    if (this.btnAiRefineToggle) {
      this.btnAiRefineToggle.onclick = () => this.toggleRefineBox();
    }
    if (this.btnSubmitAiRefine) {
      this.btnSubmitAiRefine.onclick = () => this.handleAiRefine();
    }
    if (this.aiInputFeedback) {
      this.aiInputFeedback.onkeydown = (e) => {
        if (e.key === 'Enter') this.handleAiRefine();
      };
    }
    if (this.btnAiAcceptCard) {
      this.btnAiAcceptCard.onclick = () => this.handleAiAccept();
    }

    // Completion Actions
    if (this.btnCompleteHome) {
      this.btnCompleteHome.onclick = () => this.switchTab('home');
    }
    if (this.btnCompleteRestart) {
      this.btnCompleteRestart.onclick = () => this.startStudySession();
    }
  }

  setAuthMode(mode) {
    this.authMode = mode;
    if (mode === 'login') {
      this.authTabLogin.classList.add('active');
      this.authTabRegister.classList.remove('active');
      this.authModalTitle.textContent = 'Вход в AutoFlash';
      this.btnSubmitAuth.querySelector('span').textContent = 'Войти';
    } else {
      this.authTabLogin.classList.remove('active');
      this.authTabRegister.classList.add('active');
      this.authModalTitle.textContent = 'Регистрация в AutoFlash';
      this.btnSubmitAuth.querySelector('span').textContent = 'Зарегистрироваться';
    }
  }

  openAuthModal() {
    if (this.modalAuth) {
      this.setAuthMode('login');
      this.authInputEmail.value = '';
      this.authInputPassword.value = '';
      this.modalAuth.classList.add('active');
      this.authInputEmail.focus();
    }
  }

  closeAuthModal() {
    if (this.modalAuth) {
      this.modalAuth.classList.remove('active');
    }
  }

  async handleAuthSubmit() {
    const login = this.authInputEmail.value.trim();
    const password = this.authInputPassword.value;

    if (!login || !password) {
      alert('Пожалуйста, введите логин и пароль или нажмите "Быстрый демо-вход"');
      return;
    }

    if (this.btnSubmitAuth) {
      this.btnSubmitAuth.disabled = true;
      this.btnSubmitAuth.querySelector('span').textContent = 'Вход...';
    }

    try {
      if (this.isBackendOnline) {
        const endpoint = this.authMode === 'register' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password, name: login })
        });

        if (res.ok) {
          const data = await res.json();
          this.currentUser = data.user;
          localStorage.setItem('mnemo_user', JSON.stringify(this.currentUser));
          this.updateAuthUI();
          this.closeAuthModal();
          await this.syncWithBackend();
          return;
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.detail || 'Неверный логин или пароль. Попробуйте demo / password123');
          return;
        }
      }

      // Offline fallback
      this.currentUser = {
        id: 1,
        username: login,
        email: login.includes('@') ? login : `${login}@lexicards.io`,
        name: login.split('@')[0],
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem('mnemo_user', JSON.stringify(this.currentUser));
      if (!storage.cards || storage.cards.length === 0) {
        storage.seedStarterCards();
      }
      this.updateAuthUI();
      this.closeAuthModal();
      this.renderHome();
      this.renderDictionary();
    } catch (e) {
      alert('Ошибка соединения с сервером');
    } finally {
      if (this.btnSubmitAuth) {
        this.btnSubmitAuth.disabled = false;
        this.btnSubmitAuth.querySelector('span').textContent = this.authMode === 'login' ? 'Войти' : 'Зарегистрироваться';
      }
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    this.navTabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabName) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    this.viewSections.forEach(v => {
      if (v.id === `view-${tabName}`) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    if (tabName === 'home') {
      this.renderHome();
      if (this.wordGraph) {
        setTimeout(() => this.wordGraph.resize(), 60);
      }
    }
    if (tabName === 'study') {
      if (storage.cards.length === 0) {
        if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'none';
        if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';
        if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'flex';
      } else {
        if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'none';
        if (this.studyQueue.length === 0) {
          this.startStudySession();
        }
      }
    }
    if (tabName === 'dictionary') this.renderDictionary();
  }

  renderHome() {
    const allCards = storage.cards;
    const dueCards = storage.getDueCards();
    const total = allCards.length;

    const masteredCards = allCards.filter(c => c.state === 'mastered' || (c.intervalDays && c.intervalDays >= 21));
    const reviewCards = allCards.filter(c => !masteredCards.includes(c) && (c.state === 'review' || (c.intervalDays && c.intervalDays >= 3)));
    const learningCards = allCards.filter(c => !masteredCards.includes(c) && !reviewCards.includes(c) && c.repetitionCount > 0);
    const newCards = allCards.filter(c => !masteredCards.includes(c) && !reviewCards.includes(c) && !learningCards.includes(c));

    const masteredCount = masteredCards.length;
    const reviewCount = reviewCards.length;
    const learningCount = learningCards.length;
    const newCount = newCards.length;
    const dueCount = dueCards.length;

    // Header badge & Hero Status
    if (this.headerDueBadges) {
      this.headerDueBadges.forEach(b => b.textContent = dueCount);
    }
    if (this.minimalStartBlock) {
      this.minimalStartBlock.style.display = total === 0 ? 'none' : 'flex';
    }

    if (total === 0) {
      if (this.heroDueTitle) this.heroDueTitle.textContent = 'В словаре пока нет слов';
      if (this.heroStatusPill) this.heroStatusPill.textContent = 'Старт';
      if (this.btnStartStudyHero) {
        this.btnStartStudyHero.querySelector('span').textContent = 'Добавить слово';
        this.btnStartStudyHero.onclick = () => this.openAiModal();
      }
    } else if (dueCount === 0) {
      if (this.heroDueTitle) this.heroDueTitle.textContent = 'Все слова на сегодня повторены';
      if (this.heroStatusPill) this.heroStatusPill.textContent = 'Память закреплена';
      if (this.btnStartStudyHero) {
        this.btnStartStudyHero.querySelector('span').textContent = `Повторить все (${total})`;
        this.btnStartStudyHero.onclick = () => this.startStudySession();
      }
    } else {
      if (this.heroDueTitle) this.heroDueTitle.textContent = this.getDueCardsRepetitionString(dueCount);
      if (this.heroStatusPill) this.heroStatusPill.textContent = 'SM-2 интервалы';
      if (this.btnStartStudyHero) {
        this.btnStartStudyHero.querySelector('span').textContent = `Начать тренировку (${dueCount})`;
        this.btnStartStudyHero.onclick = () => this.startStudySession();
      }
    }

    // 4 Metrics
    if (this.metricTotalWords) this.metricTotalWords.textContent = total;
    if (this.metricDueCount) this.metricDueCount.textContent = dueCount;
    if (this.metricLearningCount) this.metricLearningCount.textContent = learningCount + reviewCount;
    if (this.metricMastered) this.metricMastered.textContent = masteredCount;

    // Retention Progress Bar
    if (total > 0) {
      const pMastered = Math.round((masteredCount / total) * 100);
      const pReview = Math.round((reviewCount / total) * 100);
      const pLearning = Math.round((learningCount / total) * 100);
      const pNew = Math.max(0, 100 - pMastered - pReview - pLearning);

      if (this.segMastered) this.segMastered.style.width = `${pMastered}%`;
      if (this.segReview) this.segReview.style.width = `${pReview}%`;
      if (this.segLearning) this.segLearning.style.width = `${pLearning}%`;
      if (this.segNew) this.segNew.style.width = `${pNew}%`;
      if (this.retentionPercentText) this.retentionPercentText.textContent = `${pMastered}% в долговременной памяти`;
    }

    // Streak & Daily Target
    const reviewedToday = Number(localStorage.getItem('mnemo_reviewed_today') || '4');
    const targetGoal = 10;
    if (this.dailyTargetText) this.dailyTargetText.textContent = `${reviewedToday} / ${targetGoal} карточек`;
    if (this.dailyTargetBar) {
      const pct = Math.min(100, Math.round((reviewedToday / targetGoal) * 100));
      this.dailyTargetBar.style.width = `${pct}%`;
    }

    // Word of the Day (pick from cards or preset)
    if (allCards.length > 0) {
      const dayIndex = new Date().getDate() % allCards.length;
      this.currentWotd = allCards[dayIndex] || allCards[0];
      this.renderWordOfTheDay(this.currentWotd);
    }

    // CEFR Level Breakdown
    this.renderCefrBreakdown(allCards);

    // Update Obsidian Knowledge Graph
    if (this.wordGraph) {
      this.wordGraph.setCards(allCards);
      if (this.graphNodeCount) {
        this.graphNodeCount.textContent = `${total} слов в нейросети`;
      }
    }
  }

  pluralizeCards(count) {
    const rem10 = count % 10;
    const rem100 = count % 100;
    if (rem100 >= 11 && rem100 <= 19) return 'карточек';
    if (rem10 === 1) return 'карточка';
    if (rem10 >= 2 && rem10 <= 4) return 'карточки';
    return 'карточек';
  }

  getDueCardsRepetitionString(count) {
    const rem10 = count % 10;
    const rem100 = count % 100;
    let cardWord = 'карточек';
    let verbWord = 'ждут';
    if (rem100 >= 11 && rem100 <= 19) {
      cardWord = 'карточек';
      verbWord = 'ждут';
    } else if (rem10 === 1) {
      cardWord = 'карточка';
      verbWord = 'ждет';
    } else if (rem10 >= 2 && rem10 <= 4) {
      cardWord = 'карточки';
      verbWord = 'ждут';
    }
    return `${count} ${cardWord} ${verbWord} повторения`;
  }

  renderWordOfTheDay(card) {
    if (!card) return;
    if (this.wotdWord) this.wotdWord.textContent = card.word;
    if (this.wotdIpa) this.wotdIpa.textContent = card.transcription || '';
    if (this.wotdCefr) this.wotdCefr.textContent = card.cefrLevel || card.cefr_level || 'B1';
    if (this.wotdTranslation) this.wotdTranslation.textContent = card.translation;
    if (this.wotdExample) {
      const ex = (card.examples && card.examples[0]) ? card.examples[0] : '';
      this.wotdExample.innerHTML = ex ? `"${ex}"` : '';
    }
  }

  renderCefrBreakdown(allCards) {
    if (!this.cefrBarsList) return;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const counts = { 'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0, 'C1': 0 };

    allCards.forEach(c => {
      const lvl = (c.cefrLevel || c.cefr_level || 'B1').toUpperCase();
      if (counts[lvl] !== undefined) counts[lvl]++;
      else counts['B1']++;
    });

    const total = allCards.length || 1;
    this.cefrBarsList.innerHTML = levels.map(lvl => {
      const cnt = counts[lvl];
      const pct = Math.round((cnt / total) * 100);
      return `
        <div class="cefr-row">
          <span class="cefr-badge-label">${lvl}</span>
          <div class="cefr-track">
            <div class="cefr-fill lvl-${lvl.toLowerCase()}" style="width: ${pct}%"></div>
          </div>
          <span class="cefr-count">${cnt}</span>
        </div>
      `;
    }).join('');
  }

  startBlitzSession() {
    let queue = storage.cards.slice(0, 5);
    if (queue.length === 0) {
      if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'none';
      if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';
      if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'flex';
      this.switchTab('study');
      return;
    }
    this.studyQueue = queue;
    this.studyIndex = 0;
    this.sessionReviewedCount = 0;
    this.isRevealed = false;

    if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'none';
    if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'block';
    if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';

    this.switchTab('study');
    this.loadCard(0);
  }

  startStudySession() {
    let queue = storage.getDueCards();
    if (queue.length === 0) {
      queue = [...storage.cards];
    }

    if (queue.length === 0) {
      if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'none';
      if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';
      if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'flex';
      this.switchTab('study');
      return;
    }

    if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'none';
    if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'block';
    if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'none';

    this.studyQueue = queue;
    this.studyIndex = 0;
    this.sessionReviewedCount = 0;
    this.isRevealed = false;

    this.switchTab('study');
    this.loadCard(0);
  }

  loadCard(index, withAnimation = false) {
    if (index >= this.studyQueue.length) {
      this.showCompletionScreen();
      return;
    }

    if (this.studyEmptyWrapper) this.studyEmptyWrapper.style.display = 'none';
    if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'block';

    const card = this.studyQueue[index];
    this.isRevealed = false;

    this.studyProgressCounter.textContent = `${index + 1}/${this.studyQueue.length}`;
    this.studyCardWord.textContent = card.word;
    this.studyCardTranscription.textContent = card.transcription || '';

    // Render examples with bold highlight
    this.studyExamplesList.innerHTML = (card.examples || []).map((ex, i) => {
      return `
        <div class="example-item-text">
          <span class="n">${i + 1}.</span>
          <div>${ex}</div>
        </div>
      `;
    }).join('');

    // Answer Details
    this.studyCardTranslation.textContent = card.translation;
    this.studyCardCefr.textContent = `Уровень: ${card.cefrLevel || card.cefr_level || 'B1'}`;
    this.studyCardFreq.textContent = `Частотность: ${card.frequency || '8/10'}`;
    this.studyCardRelevance.textContent = `Актуальность: ${card.relevance || 'высокая'}`;

    if (card.collocations && card.collocations.length > 0) {
      this.studyCollocationsWrapper.style.display = 'block';
      this.studyCollocationsChips.innerHTML = card.collocations.map(col => {
        return `<span class="collocation-pill-item">${col}</span>`;
      }).join('');
    } else {
      this.studyCollocationsWrapper.style.display = 'none';
    }

    // Interval previews on buttons
    this.srsIntervalsDeck.querySelector('.again span:first-child').textContent = '1m';
    this.srsIntervalsDeck.querySelector('.hard span:first-child').textContent = formatInterval(card, SRS_RATINGS.HARD);
    this.srsIntervalsDeck.querySelector('.good span:first-child').textContent = formatInterval(card, SRS_RATINGS.GOOD);
    this.srsIntervalsDeck.querySelector('.easy span:first-child').textContent = formatInterval(card, SRS_RATINGS.EASY);

    // Reset visibility & apply enter animation
    this.studyAnswerPart.classList.remove('active');
    this.btnShowAnswer.style.display = 'flex';
    this.srsIntervalsDeck.classList.remove('active');

    const cardBody = document.querySelector('.study-card-body');
    if (cardBody) {
      cardBody.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-next');
      if (withAnimation) {
        // Trigger reflow to restart animation
        void cardBody.offsetWidth;
        cardBody.classList.add('slide-in-next');
      }
    }
  }

  showCompletionScreen() {
    if (this.studyActiveWrapper) this.studyActiveWrapper.style.display = 'none';
    if (this.studyCompleteWrapper) this.studyCompleteWrapper.style.display = 'flex';

    if (this.completeReviewedCount) {
      this.completeReviewedCount.textContent = this.sessionReviewedCount || this.studyQueue.length;
    }

    const due = storage.getDueCards().length;
    if (this.completeRemainingCount) {
      this.completeRemainingCount.textContent = due;
      this.completeRemainingCount.style.color = due === 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)';
    }

    if (this.studyConfettiCanvas) {
      triggerConfetti(this.studyConfettiCanvas);
    }
  }

  revealAnswer() {
    this.isRevealed = true;
    this.studyAnswerPart.classList.add('active');
    this.btnShowAnswer.style.display = 'none';
    this.srsIntervalsDeck.classList.add('active');
  }

  async submitRating(rating) {
    const card = this.studyQueue[this.studyIndex];
    processReview(card, rating);
    storage.addCard(card);
    this.sessionReviewedCount = (this.sessionReviewedCount || 0) + 1;

    if (this.isBackendOnline && card.id && !isNaN(card.id)) {
      try {
        await fetch(`${API_BASE}/cards/${card.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating })
        });
      } catch (_) { }
    }

    // Smooth slide out animation
    const cardBody = document.querySelector('.study-card-body');
    if (cardBody) {
      const isNegative = rating === SRS_RATINGS.AGAIN || rating === SRS_RATINGS.HARD;
      cardBody.classList.add(isNegative ? 'slide-out-left' : 'slide-out-right');
    }

    setTimeout(() => {
      this.studyIndex++;
      this.loadCard(this.studyIndex, true);
    }, 170);
  }

  renderDictionary() {
    const query = this.dictSearchInput.value.toLowerCase().trim();
    const filtered = storage.cards.filter(c => {
      return query === '' || c.word.toLowerCase().includes(query) || (c.translation && c.translation.toLowerCase().includes(query));
    });

    this.dictTotalCount.textContent = `${filtered.length} слов`;

    if (filtered.length === 0) {
      this.dictListBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 0.85rem;">Слова не найдены</div>`;
      return;
    }

    this.dictListBody.innerHTML = filtered.map(c => {
      const cefr = c.cefrLevel || c.cefr_level || 'B1';
      const interval = c.intervalDays ? `${c.intervalDays}д` : '0д';

      return `
        <div class="dict-row">
          <div class="dict-row-main">
            <div class="dict-row-top">
              <span class="dict-word-text">${c.word}</span>
              <span class="badge-pill cefr">${cefr}</span>
            </div>
            <div class="dict-row-trans">${c.translation}</div>
          </div>
          <div class="dict-row-meta">
            <span class="dict-col-interval">${interval}</span>
            <button class="btn-row-del delete-btn" data-id="${c.id}" data-word="${c.word}" title="Удалить">✕</button>
          </div>
        </div>
      `;
    }).join('');

    this.dictListBody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const word = btn.getAttribute('data-word');

        storage.deleteCard(id || word);

        if (this.isBackendOnline && id && !isNaN(Number(id))) {
          try {
            await fetch(`${API_BASE}/cards/${id}`, { method: 'DELETE' });
          } catch (_) { }
        }

        this.renderDictionary();
        this.renderHome();
      };
    });
  }

  handleTagAddFromInput() {
    const val = this.aiInputWord.value;
    if (!val) return;
    const parts = val.split(/[,\n]+/).map(w => w.trim()).filter(Boolean);
    parts.forEach(w => this.addWordTag(w));
    this.aiInputWord.value = '';
    this.renderWordTags();
  }

  addWordTag(word) {
    const clean = word.trim();
    if (!clean) return;
    const low = clean.toLowerCase();
    if (!this.batchWords.some(w => w.toLowerCase() === low)) {
      this.batchWords.push(clean);
    }
    this.updateSubmitBtnText();
  }

  removeWordTag(index) {
    this.batchWords.splice(index, 1);
    this.renderWordTags();
    this.updateSubmitBtnText();
  }

  renderWordTags() {
    if (!this.aiBatchTagsContainer) return;
    if (this.batchWords.length === 0) {
      this.aiBatchTagsContainer.style.display = 'none';
      this.aiBatchTagsContainer.innerHTML = '';
    } else {
      this.aiBatchTagsContainer.style.display = 'flex';
      this.aiBatchTagsContainer.innerHTML = this.batchWords.map((w, idx) => `
        <span class="batch-word-chip">
          <span>${w}</span>
          <button type="button" class="chip-del-btn" data-index="${idx}" title="Удалить">✕</button>
        </span>
      `).join('');

      this.aiBatchTagsContainer.querySelectorAll('.chip-del-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          this.removeWordTag(idx);
        };
      });
    }
    this.updateSubmitBtnText();
  }

  updateSubmitBtnText() {
    if (!this.btnSubmitAiText && !this.btnSubmitAiGen) return;
    const targetEl = this.btnSubmitAiText || this.btnSubmitAiGen.querySelector('span');
    const inputPending = this.aiInputWord ? this.aiInputWord.value.trim() : '';
    const totalCount = this.batchWords.length + (inputPending && !this.batchWords.includes(inputPending) ? 1 : 0);

    if (totalCount <= 1) {
      targetEl.textContent = 'Сгенерировать карточку';
    } else {
      targetEl.textContent = `Сгенерировать пакет из ${totalCount} карточек ⚡`;
    }
  }

  openAiModal() {
    if (!this.currentUser) {
      this.openAuthModal();
      return;
    }

    if (this.aiStepInput) this.aiStepInput.style.display = 'block';
    if (this.aiStepPreview) this.aiStepPreview.style.display = 'none';
    if (this.aiRefineBox) this.aiRefineBox.style.display = 'none';
    if (this.aiModalHeading) this.aiModalHeading.textContent = 'Добавить слова в словарь';

    this.aiInputWord.value = '';
    if (this.aiInputFeedback) this.aiInputFeedback.value = '';
    this.batchWords = [];
    this.generatedBatchCards = [];
    this.batchPreviewIndex = 0;
    this.currentGeneratedCard = null;
    this.renderWordTags();

    this.modalAi.classList.add('active');
    this.aiInputWord.focus();
  }

  closeAiModal() {
    this.modalAi.classList.remove('active');
  }

  toggleRefineBox() {
    if (!this.aiRefineBox) return;
    const isHidden = this.aiRefineBox.style.display === 'none';
    this.aiRefineBox.style.display = isHidden ? 'block' : 'none';
    if (isHidden && this.aiInputFeedback) {
      this.aiInputFeedback.focus();
    }
  }

  renderPreviewCard(card) {
    this.currentGeneratedCard = card;

    if (this.previewWord) this.previewWord.textContent = card.word;
    if (this.previewTranscription) this.previewTranscription.textContent = card.transcription || '';
    if (this.previewCefr) this.previewCefr.textContent = card.cefr_level || card.cefrLevel || 'B1';
    if (this.previewTranslation) this.previewTranslation.textContent = card.translation;
    if (this.previewDefinition) this.previewDefinition.textContent = card.definition_en || card.definitionEn || '';

    if (this.previewExamplesList) {
      this.previewExamplesList.innerHTML = (card.examples || []).map((ex, i) => `
        <div class="example-item-text">
          <span class="n">${i + 1}.</span>
          <div>${ex}</div>
        </div>
      `).join('');
    }

    if (this.previewCollocationsList) {
      this.previewCollocationsList.innerHTML = (card.collocations || []).map(c => `
        <span class="collocation-chip">${c}</span>
      `).join('');
    }
  }

  renderBatchPreviewUI() {
    if (this.aiModalHeading) {
      this.aiModalHeading.textContent = this.generatedBatchCards.length > 1
        ? `Предпросмотр пакета (${this.generatedBatchCards.length} карточек)`
        : 'Предпросмотр карточки';
    }
    if (this.aiStepInput) this.aiStepInput.style.display = 'none';
    if (this.aiStepPreview) this.aiStepPreview.style.display = 'block';
    if (this.aiRefineBox) this.aiRefineBox.style.display = 'none';

    if (this.generatedBatchCards.length > 1) {
      if (this.aiBatchTabs) {
        this.aiBatchTabs.style.display = 'flex';
        this.aiBatchTabs.innerHTML = this.generatedBatchCards.map((c, i) => `
          <button type="button" class="batch-tab-item ${i === this.batchPreviewIndex ? 'active' : ''}" data-idx="${i}">
            ${i + 1}. ${c.word}
          </button>
        `).join('');

        this.aiBatchTabs.querySelectorAll('.batch-tab-item').forEach(btn => {
          btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            this.switchBatchCard(idx);
          };
        });
      }

      if (this.previewCardCounter) {
        this.previewCardCounter.style.display = 'inline-block';
        this.previewCardCounter.textContent = `${this.batchPreviewIndex + 1} / ${this.generatedBatchCards.length}`;
      }

      if (this.btnAcceptText) {
        this.btnAcceptText.textContent = `Принять всё (${this.generatedBatchCards.length}) и сохранить`;
      }
    } else {
      if (this.aiBatchTabs) this.aiBatchTabs.style.display = 'none';
      if (this.previewCardCounter) this.previewCardCounter.style.display = 'none';
      if (this.btnAcceptText) this.btnAcceptText.textContent = 'Принять и сохранить';
    }

    const currentCard = this.generatedBatchCards[this.batchPreviewIndex] || this.generatedBatchCards[0];
    if (currentCard) {
      this.renderPreviewCard(currentCard);
    }
  }

  switchBatchCard(index) {
    if (index < 0 || index >= this.generatedBatchCards.length) return;
    this.batchPreviewIndex = index;
    this.renderBatchPreviewUI();
  }

  async handleAiGenerate() {
    if (!this.currentUser) {
      this.closeAiModal();
      this.openAuthModal();
      return;
    }

    // Collect words from batch list plus current input
    const pending = this.aiInputWord.value.trim();
    if (pending) {
      const parts = pending.split(/[,\n]+/).map(w => w.trim()).filter(Boolean);
      parts.forEach(w => this.addWordTag(w));
      this.aiInputWord.value = '';
    }

    const wordsToGenerate = [...this.batchWords];
    if (wordsToGenerate.length === 0) return;

    this.btnSubmitAiGen.disabled = true;
    const targetLabel = this.btnSubmitAiText || this.btnSubmitAiGen.querySelector('span');
    targetLabel.textContent = wordsToGenerate.length > 1 
      ? `Генерация пакета (${wordsToGenerate.length} слов)...` 
      : 'Генерация...';

    try {
      let cards = [];

      if (this.isBackendOnline) {
        if (wordsToGenerate.length === 1) {
          const res = await fetch(`${API_BASE}/cards/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              word: wordsToGenerate[0],
              user_id: this.currentUser ? this.currentUser.id : null
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.card) cards = [data.card];
          } else if (res.status === 401) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Для генерации необходимо войти в аккаунт');
            this.closeAiModal();
            this.openAuthModal();
            return;
          }
        } else {
          // Batch LLM call (Single Prompt, saves AI tokens)
          const res = await fetch(`${API_BASE}/cards/preview-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              words: wordsToGenerate,
              user_id: this.currentUser ? this.currentUser.id : null
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.cards)) cards = data.cards;
          } else if (res.status === 401) {
            const err = await res.json().catch(() => ({}));
            alert(err.detail || 'Для генерации необходимо войти в аккаунт');
            this.closeAiModal();
            this.openAuthModal();
            return;
          }
        }
      }

      if (!cards || cards.length === 0) {
        if (wordsToGenerate.length === 1) {
          const single = await generateCardData(wordsToGenerate[0]);
          cards = [single];
        } else {
          cards = await generateBatchCardsData(wordsToGenerate);
        }
      }

      this.generatedBatchCards = cards;
      this.batchPreviewIndex = 0;
      this.renderBatchPreviewUI();
    } catch (e) {
      console.error(e);
      alert('Ошибка при генерации карточек');
    } finally {
      this.btnSubmitAiGen.disabled = false;
      this.updateSubmitBtnText();
    }
  }

  async handleAiRefine() {
    if (!this.currentUser) {
      this.closeAiModal();
      this.openAuthModal();
      return;
    }

    const currentCard = this.generatedBatchCards[this.batchPreviewIndex] || this.currentGeneratedCard;
    if (!currentCard) return;
    const feedback = this.aiInputFeedback ? this.aiInputFeedback.value.trim() : '';
    if (!feedback) return;

    if (this.btnSubmitAiRefine) {
      this.btnSubmitAiRefine.disabled = true;
      this.btnSubmitAiRefine.querySelector('span').textContent = 'Доработка...';
    }

    try {
      let cardData = null;

      if (this.isBackendOnline) {
        const res = await fetch(`${API_BASE}/cards/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: currentCard.word,
            user_id: this.currentUser ? this.currentUser.id : null,
            feedback,
            previous_card: currentCard
          })
        });
        if (res.ok) {
          const data = await res.json();
          cardData = data.card;
        }
      }

      if (!cardData) {
        cardData = await generateCardData(currentCard.word);
      }

      if (this.generatedBatchCards.length > 0) {
        this.generatedBatchCards[this.batchPreviewIndex] = cardData;
      }
      this.renderBatchPreviewUI();
    } catch (e) {
      alert('Ошибка при доработке карточки');
    } finally {
      if (this.btnSubmitAiRefine) {
        this.btnSubmitAiRefine.disabled = false;
        this.btnSubmitAiRefine.querySelector('span').textContent = 'Перегенерировать текущую карточку';
      }
    }
  }

  async handleAiAccept() {
    const cardsToSave = this.generatedBatchCards.length > 0 
      ? this.generatedBatchCards 
      : (this.currentGeneratedCard ? [this.currentGeneratedCard] : []);

    if (cardsToSave.length === 0) return;

    const formattedCards = cardsToSave.map(c => ({
      ...c,
      user_id: this.currentUser ? this.currentUser.id : 1
    }));

    if (this.btnAiAcceptCard) {
      this.btnAiAcceptCard.disabled = true;
      const targetLabel = this.btnAcceptText || this.btnAiAcceptCard.querySelector('span');
      targetLabel.textContent = 'Сохранение...';
    }

    try {
      if (this.isBackendOnline) {
        if (formattedCards.length > 1) {
          const res = await fetch(`${API_BASE}/cards/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cards: formattedCards,
              user_id: this.currentUser ? this.currentUser.id : 1
            })
          });
          if (res.ok) {
            await this.syncWithBackend();
          } else {
            formattedCards.forEach(c => storage.addCard(c));
          }
        } else {
          const res = await fetch(`${API_BASE}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formattedCards[0])
          });
          if (res.ok) {
            await this.syncWithBackend();
          } else {
            storage.addCard(formattedCards[0]);
          }
        }
      } else {
        formattedCards.forEach(c => storage.addCard(c));
      }

      this.closeAiModal();
      this.renderHome();
      this.renderDictionary();

      if (this.currentTab === 'study' && this.studyQueue.length === 0) {
        this.startStudySession();
      }
    } catch (e) {
      alert('Ошибка при сохранении карточек');
    } finally {
      if (this.btnAiAcceptCard) {
        this.btnAiAcceptCard.disabled = false;
        const targetLabel = this.btnAcceptText || this.btnAiAcceptCard.querySelector('span');
        targetLabel.textContent = 'Принять и сохранить';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LexiSimpleApp();
});
