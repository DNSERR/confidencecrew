const PUZZLE_CONFIG = {
  SIZE: 10,
  MIN_WORD_LENGTH: 3,
  MAX_WORD_LENGTH: 10,
  FEEDBACK_DELAY: 1500,
  BASE_SCORE: 100,
  MAX_WIDTH: 360,
  MAX_HEIGHT: 360,
  CELL_FONT_SIZE_RATIO: 0.6
};

class WordPuzzleGame {
  constructor() {
    this.state = {
      score: 0,
      currentWord: '',
      grid: [],
      isPremium: false,
      foundLetters: [],
      level: 1,
      wordIndex: 0,
      language: navigator.language.split('-')[0]
    };
    this.wordDatabase = [];
    this.affirmations = {};
    this.seenAffirmations = {};
    this.filteredWords = [];
    this.supportedLanguages = ['en', 'es', 'de', 'fr', 'ar', 'gu', 'hi', 'pt', 'zh'];
  }

  async initialize() {
    try {
      await this.loadState();
      await this.loadResources();
      this.setupUI();
      this.generatePuzzle();
    } catch (error) {
      console.error('Initialization error:', error);
      this.showFeedback('Failed to initialize the game. Please try again.');
    }
  }

  async loadState() {
    try {
      const result = await chrome.storage.sync.get(['score', 'isPremium', 'level', 'wordIndex', 'language']);
      this.state = { ...this.state, ...result };
    } catch (error) {
      console.error('Error loading state:', error);
      this.showFeedback('Failed to load game state. Using default values.');
    }
  }

  async saveState() {
    try {
      await chrome.storage.sync.set({
        score: this.state.score,
        isPremium: this.state.isPremium,
        level: this.state.level,
        wordIndex: this.state.wordIndex,
        language: this.state.language
      });
    } catch (error) {
      console.error('Error saving state:', error);
      this.showFeedback('Failed to save game state. Your progress may not be retained.');
    }
  }

  async loadResources() {
    try {
      const [wordsResponse, ...affirmationResponses] = await Promise.all([
        fetch('data/words.json'),
        ...this.supportedLanguages.map(lang => fetch(`data/affirmations_${lang}.json`))
      ]);
      
      const wordsData = await wordsResponse.json();
      this.wordDatabase = wordsData.words;

      for (let i = 0; i < this.supportedLanguages.length; i++) {
        const lang = this.supportedLanguages[i];
        const affirmationsData = await affirmationResponses[i].json();
        this.affirmations[lang] = affirmationsData.affirmations;
        this.seenAffirmations[lang] = new Set();
      }
    } catch (error) {
      console.error('Error loading resources:', error);
      this.showFeedback('Using fallback data due to loading error.');
      this.useFallbackData();
    }
  }

  useFallbackData() {
    this.wordDatabase = ['HAPPY', 'BRAVE', 'SMART', 'CONFIDENT', 'STRONG', 'CAPABLE'];
    this.supportedLanguages.forEach(lang => {
      this.affirmations[lang] = ['You are amazing!', 'You can do it!', 'Believe in yourself!'];
      this.seenAffirmations[lang] = new Set();
    });
  }

  setupUI() {
    const elements = this.getUIElements();
    this.updateUIElements(elements);
    this.setupEventListeners(elements);
    this.setupPuzzleListeners();
  }

  getUIElements() {
    return {
      score: document.getElementById('score'),
      level: document.getElementById('level'),
      word: document.getElementById('current-word'),
      nextWord: document.getElementById('next-word-btn'),
      resetGame: document.getElementById('reset-game-btn'),
      premium: document.getElementById('premium-section'),
      upgradeBtn: document.getElementById('upgrade-btn'),
      dailyAffirmation: document.getElementById('daily-affirmation'),
      affirmationBtn: document.getElementById('affirmation-btn')
    };
  }

  updateUIElements(elements) {
    this.updateUIElement('score', this.state.score);
    this.updateUIElement('level', this.state.level);
    this.updateUIElement('current-word', this.state.currentWord);
    if (this.state.isPremium) {
      this.showPremiumFeatures(elements);
    } else {
      this.showUpgradeButton(elements);
    }
  }

  updateUIElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
  }

  setupEventListeners(elements) {
    if (elements.nextWord) elements.nextWord.addEventListener('click', () => this.generatePuzzle());
    if (elements.resetGame) elements.resetGame.addEventListener('click', () => this.resetGame());
    if (elements.upgradeBtn) elements.upgradeBtn.addEventListener('click', () => this.handleUpgrade());
    if (elements.affirmationBtn) elements.affirmationBtn.addEventListener('click', () => this.showDailyAffirmation(elements.dailyAffirmation));
  }

  generatePuzzle() {
    try {
      const word = this.getNextWord();
      this.state.currentWord = word;
      this.state.grid = this.createPuzzleGrid(word);
      this.state.foundLetters = [];
      this.updateUI();
      this.saveState();
    } catch (error) {
      console.error('Error generating puzzle:', error);
      this.showFeedback('Failed to generate a new puzzle. Please try again.');
    }
  }

  getNextWord() {
    if (!this.filteredWords || this.filteredWords.length === 0) {
      const minLength = Math.min(PUZZLE_CONFIG.MIN_WORD_LENGTH + Math.floor(this.state.level / 5), PUZZLE_CONFIG.MAX_WORD_LENGTH);
      this.filteredWords = this.wordDatabase.filter(word =>
        word.length >= minLength && word.length <= PUZZLE_CONFIG.MAX_WORD_LENGTH
      );
      this.shuffleArray(this.filteredWords);
      this.state.wordIndex = 0;
    }
    const word = this.filteredWords[this.state.wordIndex];
    this.state.wordIndex = (this.state.wordIndex + 1) % this.filteredWords.length;
    return word;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  createPuzzleGrid(word) {
    const grid = Array(PUZZLE_CONFIG.SIZE).fill().map(() => 
      Array(PUZZLE_CONFIG.SIZE).fill().map(() => 
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      )
    );

    const directions = ['horizontal', 'vertical', 'diagonal', 'reverse-horizontal', 'reverse-vertical', 'reverse-diagonal'];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    
    let row, col;
    switch (direction) {
      case 'horizontal':
      case 'reverse-horizontal':
        row = Math.floor(Math.random() * PUZZLE_CONFIG.SIZE);
        col = Math.floor(Math.random() * (PUZZLE_CONFIG.SIZE - word.length + 1));
        break;
      case 'vertical':
      case 'reverse-vertical':
        row = Math.floor(Math.random() * (PUZZLE_CONFIG.SIZE - word.length + 1));
        col = Math.floor(Math.random() * PUZZLE_CONFIG.SIZE);
        break;
      case 'diagonal':
      case 'reverse-diagonal':
        row = Math.floor(Math.random() * (PUZZLE_CONFIG.SIZE - word.length + 1));
        col = Math.floor(Math.random() * (PUZZLE_CONFIG.SIZE - word.length + 1));
        break;
    }

    for (let i = 0; i < word.length; i++) {
      const letter = direction.startsWith('reverse') ? word[word.length - 1 - i] : word[i];
      switch (direction) {
        case 'horizontal':
        case 'reverse-horizontal':
          grid[row][col + i] = letter;
          break;
        case 'vertical':
        case 'reverse-vertical':
          grid[row + i][col] = letter;
          break;
        case 'diagonal':
        case 'reverse-diagonal':
          grid[row + i][col + i] = letter;
          break;
      }
    }

    return grid;
  }

  updateUI() {
    const puzzleContainer = document.getElementById('puzzle-container');
    if (!puzzleContainer) return;

    puzzleContainer.innerHTML = '';
    const cellSize = Math.min(
      PUZZLE_CONFIG.MAX_WIDTH / PUZZLE_CONFIG.SIZE,
      PUZZLE_CONFIG.MAX_HEIGHT / PUZZLE_CONFIG.SIZE
    );

    puzzleContainer.style.width = `${cellSize * PUZZLE_CONFIG.SIZE}px`;
    puzzleContainer.style.height = `${cellSize * PUZZLE_CONFIG.SIZE}px`;

    this.state.grid.forEach((row, rowIndex) => {
      row.forEach((letter, colIndex) => {
        const cell = document.createElement('div');
        cell.className = 'puzzle-cell';
        cell.textContent = letter;
        cell.dataset.row = rowIndex;
        cell.dataset.col = colIndex;
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.fontSize = `${cellSize * PUZZLE_CONFIG.CELL_FONT_SIZE_RATIO}px`;
        puzzleContainer.appendChild(cell);
      });
    });

    this.updateUIElements(this.getUIElements());
  }

  setupPuzzleListeners() {
    const puzzleContainer = document.getElementById('puzzle-container');
    if (!puzzleContainer) return;

    puzzleContainer.addEventListener('click', (event) => {
      const cell = event.target.closest('.puzzle-cell');
      if (!cell) return;

      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      const letter = this.state.grid[row][col];

      if (this.state.currentWord.includes(letter)) {
        const existingIndex = this.state.foundLetters.findIndex(l => l.row === row && l.col === col);
        if (existingIndex !== -1) {
          this.state.foundLetters.splice(existingIndex, 1);
          cell.classList.remove('highlighted');
        } else {
          this.state.foundLetters.push({ row, col, letter });
          cell.classList.add('highlighted');
        }
        this.checkWordCompletion();
      }
    });
  }

  checkWordCompletion() {
    const foundWord = this.state.foundLetters.map(l => l.letter).join('');
    if (foundWord === this.state.currentWord) {
      this.state.score += this.state.currentWord.length;
      this.showFeedback('YES! GREAT JOB!');
      this.calculateLevel();
      setTimeout(() => this.generatePuzzle(), PUZZLE_CONFIG.FEEDBACK_DELAY);
    }
    this.saveState();
  }

  calculateLevel() {
    const level = Math.floor(this.state.score / PUZZLE_CONFIG.BASE_SCORE) + 1;
    if (level !== this.state.level) {
      this.state.level = level;
      this.showFeedback(`Congratulations! You've reached level ${level}!`);
    }
  }

  showFeedback(message) {
    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
      feedbackElement.textContent = message;
      feedbackElement.style.animation = 'none';
      setTimeout(() => {
        feedbackElement.style.animation = 'bounce 0.5s';
      }, 10);
      setTimeout(() => feedbackElement.textContent = '', PUZZLE_CONFIG.FEEDBACK_DELAY);
    }
  }

  resetGame() {
    this.state = {
      score: 0,
      currentWord: '',
      grid: [],
      isPremium: this.state.isPremium,
      foundLetters: [],
      level: 1,
      wordIndex: 0,
      language: this.state.language
    };
    this.filteredWords = [];
    this.saveState();
    this.generatePuzzle();
  }

  showPremiumFeatures(elements) {
    if (elements.premium) elements.premium.classList.remove('hidden');
    this.showDailyAffirmation(elements.dailyAffirmation);
  }

  showUpgradeButton(elements) {
    if (elements.premium) elements.premium.classList.add('hidden');
    if (elements.upgradeBtn) elements.upgradeBtn.classList.remove('hidden');
  }

  showDailyAffirmation(element) {
    const lang = this.supportedLanguages.includes(this.state.language) ? this.state.language : 'en';
    if (element && this.affirmations[lang] && this.affirmations[lang].length > 0) {
      if (this.seenAffirmations[lang].size === this.affirmations[lang].length) {
        this.seenAffirmations[lang].clear();
      }
      let affirmationIndex;
      do {
        affirmationIndex = Math.floor(Math.random() * this.affirmations[lang].length);
      } while (this.seenAffirmations[lang].has(affirmationIndex));
      this.seenAffirmations[lang].add(affirmationIndex);
      element.textContent = this.affirmations[lang][affirmationIndex];
    }
  }

  async handleUpgrade() {
    try {
      // Replace 'your_stripe_link' with the actual link provided by Stripe
      const stripeLink = 'https://buy.stripe.com/eVa9DE4Rxd7xfNS006';
      window.location.href = stripeLink;
    } catch (error) {
      console.error('Error starting upgrade process:', error);
      this.showFeedback('Failed to start upgrade process. Please try again.');
    }
  }
}

const game = new WordPuzzleGame();
document.addEventListener('DOMContentLoaded', () => game.initialize());
