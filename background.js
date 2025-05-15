const PUZZLE_CONFIG = {
  STORAGE_KEYS: {
    WORD_INDEX: 'wordIndex',
    SCORE: 'score',
    IS_PREMIUM: 'isPremium',
    LAST_PLAYED: 'lastPlayed',
    DAILY_AFFIRMATION: 'dailyAffirmation',
    LANGUAGE: 'language'
  },
  ALARM_NAME: 'dailyReminder',
  NOTIFICATION_ID: 'dailyPuzzleReminder',
  DEFAULT_LANGUAGE: 'en',
  NOTIFICATION_ICON: 'icons/icon128.png'
};

class BackgroundManager {
  constructor() {
    this.initializeListeners();
  }

  initializeListeners() {
    chrome.runtime.onInstalled.addListener(() => this.initializeDefaultState());
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => this.handleMessage(request, sender, sendResponse));
    chrome.alarms.onAlarm.addListener((alarm) => this.handleAlarm(alarm));
    chrome.notifications.onClicked.addListener((notificationId) => this.handleNotificationClick(notificationId));
    chrome.storage.onChanged.addListener((changes, namespace) => this.handleStorageChange(changes, namespace));
  }

  async initializeDefaultState() {
    const defaultState = {
      [PUZZLE_CONFIG.STORAGE_KEYS.WORD_INDEX]: 0,
      [PUZZLE_CONFIG.STORAGE_KEYS.SCORE]: 0,
      [PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM]: false,
      [PUZZLE_CONFIG.STORAGE_KEYS.LAST_PLAYED]: new Date().toISOString(),
      [PUZZLE_CONFIG.STORAGE_KEYS.DAILY_AFFIRMATION]: '',
      [PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE]: navigator.language.split('-')[0]
    };

    try {
      await chrome.storage.sync.set(defaultState);
      console.log("Default state initialized.");
      this.setupDailyAlarm();
    } catch (error) {
      this.handleError('initializeDefaultState', error);
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case "saveProgress":
        this.saveProgress(request.data, sendResponse);
        break;
      case "getPremiumStatus":
        this.getPremiumStatus(sendResponse);
        break;
      case "getDailyAffirmation":
        this.getDailyAffirmation(sendResponse);
        break;
      case "setLanguage":
        this.setLanguage(request.language, sendResponse);
        break;
      default:
        sendResponse({ status: "error", message: "Unknown action" });
    }
    return true;
  }

  async saveProgress(data, sendResponse) {
    const updateData = {
      [PUZZLE_CONFIG.STORAGE_KEYS.WORD_INDEX]: data.wordIndex,
      [PUZZLE_CONFIG.STORAGE_KEYS.SCORE]: data.score,
      [PUZZLE_CONFIG.STORAGE_KEYS.LAST_PLAYED]: new Date().toISOString()
    };

    try {
      await chrome.storage.sync.set(updateData);
      console.log("Progress saved:", data);
      sendResponse({ status: "success" });
    } catch (error) {
      this.handleError('saveProgress', error);
      sendResponse({ status: "error", message: "Failed to save progress." });
    }
  }

  async getPremiumStatus(sendResponse) {
    try {
      const data = await chrome.storage.sync.get([PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM]);
      sendResponse({ isPremium: data[PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM] || false });
    } catch (error) {
      this.handleError('getPremiumStatus', error);
      sendResponse({ isPremium: false });
    }
  }

  async getDailyAffirmation(sendResponse) {
    try {
      const data = await chrome.storage.sync.get([PUZZLE_CONFIG.STORAGE_KEYS.DAILY_AFFIRMATION, PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE]);
      sendResponse({
        affirmation: data[PUZZLE_CONFIG.STORAGE_KEYS.DAILY_AFFIRMATION] || "",
        language: data[PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE] || PUZZLE_CONFIG.DEFAULT_LANGUAGE
      });
    } catch (error) {
      this.handleError('getDailyAffirmation', error);
      sendResponse({ affirmation: "", language: PUZZLE_CONFIG.DEFAULT_LANGUAGE });
    }
  }

  async setLanguage(language, sendResponse) {
    try {
      await chrome.storage.sync.set({ [PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE]: language });
      console.log("Language set:", language);
      sendResponse({ status: "success" });
    } catch (error) {
      this.handleError('setLanguage', error);
      sendResponse({ status: "error", message: "Failed to set language." });
    }
  }

  setupDailyAlarm() {
    chrome.alarms.create(PUZZLE_CONFIG.ALARM_NAME, { periodInMinutes: 1440 });
  }

  handleAlarm(alarm) {
    if (alarm.name === PUZZLE_CONFIG.ALARM_NAME) {
      this.checkAndNotifyUser();
    }
  }

  async checkAndNotifyUser() {
    try {
      const data = await chrome.storage.sync.get([
        PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM,
        PUZZLE_CONFIG.STORAGE_KEYS.LAST_PLAYED,
        PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE
      ]);

      const lastPlayed = new Date(data[PUZZLE_CONFIG.STORAGE_KEYS.LAST_PLAYED]);
      const today = new Date();
      const hasPlayedToday = lastPlayed.toDateString() === today.toDateString();

      if (data[PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM] && !hasPlayedToday) {
        this.createNotification(data[PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE]);
      }
    } catch (error) {
      this.handleError('checkAndNotifyUser', error);
    }
  }

  createNotification(language) {
    const messages = {
      en: "Your daily confidence-boosting puzzle is ready!",
      es: "¡Tu rompecabezas diario para aumentar la confianza está listo!",
      fr: "Votre puzzle quotidien pour booster votre confiance est prêt !",
      de: "Ihr tägliches Selbstvertrauens-Puzzle ist bereit!",
    };

    const notificationOptions = {
      type: "basic",
      iconUrl: PUZZLE_CONFIG.NOTIFICATION_ICON,
      title: "Daily Word Puzzle",
      message: messages[language] || messages[PUZZLE_CONFIG.DEFAULT_LANGUAGE],
      priority: 2
    };

    chrome.notifications.create(PUZZLE_CONFIG.NOTIFICATION_ID, notificationOptions, (notificationId) => {
      if (chrome.runtime.lastError) {
        this.handleError('createNotification', chrome.runtime.lastError);
      } else {
        console.log("Notification created with ID:", notificationId);
      }
    });
  }

  handleNotificationClick(notificationId) {
    if (notificationId === PUZZLE_CONFIG.NOTIFICATION_ID) {
      chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    }
  }

  handleStorageChange(changes, namespace) {
    if (changes[PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM]) {
      console.log(`Premium status changed to: ${changes[PUZZLE_CONFIG.STORAGE_KEYS.IS_PREMIUM].newValue}`);
    }
    if (changes[PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE]) {
      console.log(`Language changed to: ${changes[PUZZLE_CONFIG.STORAGE_KEYS.LANGUAGE].newValue}`);
    }
  }

  handleError(context, error) {
    console.error(`Error in ${context}:`, error);
  }
}

const backgroundManager = new BackgroundManager();
