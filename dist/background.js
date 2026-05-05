"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var Reason = chrome.offscreen.Reason;
var ContextType = chrome.runtime.ContextType;
// ======================== CONSTANTS ========================
const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const OPEN_PROLIFIC = "openProlific";
const AUDIO = "audio";
const VOLUME = "volume";
const COUNTER = "counter";
const AUTO_RESERVE = "autoReserveEnabled";
const ICON_URL = 'imgs/logo.png';
const TITLE = 'Prolific Automatic Studies';
const MESSAGE = 'A new study has been posted on Prolific!';
const PROLIFIC_TITLE = 'prolificTitle';
// ======================== STATE ========================
let creating;
let volume;
let audio;
let shouldSendNotification;
let shouldPlayAudio;
let previousTitle;
// ======================== API POLLING (Background) ========================
const API_BASE = 'https://internal-api.prolific.com/api/v1';
const POLL_ALARM_NAME = 'prolific-api-poll';
const FAST_POLL_ALARM_NAME = 'prolific-fast-poll';
// ======================== MESSAGE HANDLERS ========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessages(message, sender, sendResponse);
    return true; // Needed for async sendResponse
});
chrome.notifications.onClicked.addListener(function (notificationId) {
    chrome.tabs.create({ url: "https://app.prolific.com/studies", active: true });
    chrome.notifications.clear(notificationId);
});
chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
    if (buttonIndex === 0) {
        chrome.tabs.create({ url: "https://app.prolific.com/studies", active: true });
    }
    chrome.notifications.clear(notificationId);
});
// ======================== INSTALLATION ========================
chrome.runtime.onInstalled.addListener((details) => __awaiter(void 0, void 0, void 0, function* () {
    if (details.reason === "install") {
        yield setInitialValues();
        yield new Promise(resolve => setTimeout(resolve, 1000));
        yield chrome.tabs.create({ url: "https://github.com/aymank2020/Prolific_Automatic_Studies", active: true });
    }
    // Set up alarms for periodic checking
    setupAlarms();
}));
// ======================== STARTUP ========================
chrome.runtime.onStartup.addListener(function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield getValueFromStorage(OPEN_PROLIFIC, false)) {
            yield chrome.tabs.create({ url: "https://app.prolific.com/studies", active: false });
        }
        setupAlarms();
    });
});
// ======================== ALARMS ========================
function setupAlarms() {
    // Regular poll every 30 seconds
    chrome.alarms.create(POLL_ALARM_NAME, {
        periodInMinutes: 0.5, // 30 seconds
    });
}
chrome.alarms.onAlarm.addListener((alarm) => __awaiter(void 0, void 0, void 0, function* () {
    if (alarm.name === POLL_ALARM_NAME) {
        yield checkProlificTab();
    }
    if (alarm.name === FAST_POLL_ALARM_NAME) {
        yield triggerContentScriptCheck();
    }
}));
// ======================== UTILITY FUNCTIONS ========================
function getValueFromStorage(key, defaultValue) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, function (result) {
            resolve((result[key] !== undefined) ? result[key] : defaultValue);
        });
    });
}
function getNumberFromTitle(title) {
    const match = title.match(/\((\d+)\)/);
    return match ? parseInt(match[1]) : 0;
}
// ======================== MESSAGE HANDLER ========================
function handleMessages(message, sender, sendResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (message.target !== 'background') {
            return;
        }
        switch (message.type) {
            case 'play-sound':
                audio = yield getValueFromStorage(AUDIO, 'alert1.mp3');
                volume = (yield getValueFromStorage(VOLUME, 100)) / 100;
                yield playAudio(audio, volume);
                sendNotification();
                break;
            case 'show-notification':
                sendNotification();
                break;
            case 'clear-badge':
                yield chrome.action.setBadgeText({ text: '' });
                break;
            // New: Study detected by content script
            case 'studies-detected':
                console.log('[Background] Studies detected:', message.data);
                yield handleStudiesDetected(message.data);
                break;
            // New: Study reserved by content script
            case 'study-reserved':
                console.log('[Background] Study reserved:', message.data);
                yield handleStudyReserved(message.data);
                if ((_a = message.data) === null || _a === void 0 ? void 0 : _a.count) {
                    yield addToHistory(message.data);
                }
                break;
            // New: Toggle auto-reserve
            case 'toggle-auto-reserve':
                const enabled = (_c = (_b = message.data) === null || _b === void 0 ? void 0 : _b.enabled) !== null && _c !== void 0 ? _c : true;
                yield chrome.storage.sync.set({ [AUTO_RESERVE]: enabled });
                // Forward to content script
                yield broadcastToContentScripts({
                    target: 'content-script',
                    type: 'toggle-auto-reserve',
                    data: { enabled },
                });
                break;
            // New: Force check from popup
            case 'force-check':
                yield triggerContentScriptCheck();
                break;
            // New: Get status from content scripts
            case 'get-status':
                // This will be handled via sendResponse in the listener
                break;
            // WhatsApp: Open study link from WhatsApp monitor
            case 'open-study-link':
                console.log('[Background] Opening study from WhatsApp:', (_d = message.data) === null || _d === void 0 ? void 0 : _d.url);
                if ((_e = message.data) === null || _e === void 0 ? void 0 : _e.url) {
                    yield chrome.tabs.create({ url: message.data.url, active: true });
                    // Play sound alert
                    shouldPlayAudio = yield getValueFromStorage(AUDIO_ACTIVE, true);
                    if (shouldPlayAudio) {
                        audio = yield getValueFromStorage(AUDIO, 'alert1.mp3');
                        volume = (yield getValueFromStorage(VOLUME, 100)) / 100;
                        yield playAudio(audio, volume);
                    }
                    // Send notification
                    sendNotification(`📱 Study from WhatsApp! Opening: ${message.data.studyId || 'unknown'}`);
                }
                break;
            // WhatsApp: Study found notification
            case 'whatsapp-study-found':
                console.log('[Background] WhatsApp study found:', message.data);
                shouldSendNotification = yield getValueFromStorage(SHOW_NOTIFICATION, true);
                if (shouldSendNotification) {
                    sendNotification(`📱 New study link from WhatsApp! ID: ${((_f = message.data) === null || _f === void 0 ? void 0 : _f.studyId) || 'unknown'}`);
                }
                break;
            // Content Script: Close Tab
            case 'close-tab':
                console.log('[Background] Closing tab as requested by content script:', (_g = sender.tab) === null || _g === void 0 ? void 0 : _g.id);
                if ((_h = sender.tab) === null || _h === void 0 ? void 0 : _h.id) {
                    chrome.tabs.remove(sender.tab.id).catch(e => console.error("Failed to close tab:", e));
                }
                break;
        }
    });
}
function addToHistory(data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const history = yield getValueFromStorage('studyHistory', []);
            let studyInfo = data.study || {};
            history.unshift({
                timestamp: Date.now(),
                count: data.count || 1,
                id: data.id || studyInfo.id || 'unknown',
                title: studyInfo.name || 'Unknown Study',
                researcher: ((_a = studyInfo.researcher) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Researcher',
                pay: studyInfo.reward || 0,
                payPerHour: studyInfo.estimated_reward_per_hour || 0,
                duration: studyInfo.estimated_completion_time || 0,
                places: studyInfo.total_available_places || 0,
                source: data.source || 'auto'
            });
            // Keep only last 50 studies for a richer history
            if (history.length > 50)
                history.length = 50;
            yield chrome.storage.local.set({ studyHistory: history });
        }
        catch (e) { }
    });
}
// ======================== STUDY HANDLERS ========================
function handleStudiesDetected(data) {
    return __awaiter(this, void 0, void 0, function* () {
        shouldSendNotification = yield getValueFromStorage(SHOW_NOTIFICATION, true);
        if (shouldSendNotification) {
            sendNotification((data === null || data === void 0 ? void 0 : data.count) ? `${data.count} studies available!` : undefined);
        }
        shouldPlayAudio = yield getValueFromStorage(AUDIO_ACTIVE, true);
        if (shouldPlayAudio) {
            audio = yield getValueFromStorage(AUDIO, 'alert1.mp3');
            volume = (yield getValueFromStorage(VOLUME, 100)) / 100;
            yield playAudio(audio, volume);
        }
        // Update badge
        if (data === null || data === void 0 ? void 0 : data.count) {
            yield updateBadge(data.count);
        }
        // Bring Prolific tab to front
        yield focusProlificTab();
    });
}
function handleStudyReserved(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const count = (data === null || data === void 0 ? void 0 : data.count) || 1;
        yield updateCounterAndBadge(count);
        // Send success notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL(ICON_URL),
            title: '🎉 Study Reserved!',
            message: `Successfully reserved ${count} study/studies!`,
            buttons: [{ title: 'Open Prolific' }, { title: 'Dismiss' }],
        });
        // Play success sound
        shouldPlayAudio = yield getValueFromStorage(AUDIO_ACTIVE, true);
        if (shouldPlayAudio) {
            audio = yield getValueFromStorage(AUDIO, 'alert1.mp3');
            volume = (yield getValueFromStorage(VOLUME, 100)) / 100;
            yield playAudio(audio, volume);
        }
    });
}
// ======================== PROLIFIC TAB MANAGEMENT ========================
/**
 * Find the active Prolific tab
 */
function findProlificTab() {
    return __awaiter(this, void 0, void 0, function* () {
        const tabs = yield chrome.tabs.query({ url: "https://app.prolific.com/*" });
        return tabs.length > 0 ? tabs[0] : null;
    });
}
/**
 * Focus the Prolific tab
 */
function focusProlificTab() {
    return __awaiter(this, void 0, void 0, function* () {
        const tab = yield findProlificTab();
        if (tab && tab.id) {
            try {
                yield chrome.tabs.update(tab.id, { active: true });
                if (tab.windowId) {
                    yield chrome.windows.update(tab.windowId, { focused: true });
                }
            }
            catch (e) {
                console.log('[Background] Could not focus tab:', e);
            }
        }
    });
}
/**
 * Check the Prolific tab status periodically
 */
function checkProlificTab() {
    return __awaiter(this, void 0, void 0, function* () {
        const tab = yield findProlificTab();
        if (!tab)
            return;
        // If the tab title indicates studies available, trigger notification
        if (tab.title) {
            const currentNumber = getNumberFromTitle(tab.title);
            if (currentNumber > 0) {
                console.log(`[Background] Alarm check: ${currentNumber} studies detected from title`);
                yield handleStudiesDetected({ count: currentNumber, source: 'alarm' });
            }
        }
    });
}
/**
 * Send a message to all content scripts on Prolific tabs
 */
function broadcastToContentScripts(message) {
    return __awaiter(this, void 0, void 0, function* () {
        const tabs = yield chrome.tabs.query({ url: "https://app.prolific.com/*" });
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    yield chrome.tabs.sendMessage(tab.id, message);
                }
                catch (e) {
                    // Content script may not be ready
                }
            }
        }
    });
}
/**
 * Trigger content script to check for studies immediately
 */
function triggerContentScriptCheck() {
    return __awaiter(this, void 0, void 0, function* () {
        yield broadcastToContentScripts({
            target: 'content-script',
            type: 'force-check',
        });
    });
}
// ======================== TAB LISTENER (Original + Enhanced) ========================
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => __awaiter(void 0, void 0, void 0, function* () {
    previousTitle = yield getValueFromStorage(PROLIFIC_TITLE, 'Prolific');
    if (tab.url && tab.url.includes('https://app.prolific.com/') && changeInfo.title && changeInfo.title !== previousTitle && tab.status === 'complete') {
        const previousNumber = getNumberFromTitle(previousTitle);
        const currentNumber = getNumberFromTitle(changeInfo.title);
        yield chrome.storage.sync.set({ [PROLIFIC_TITLE]: changeInfo.title });
        if (changeInfo.title.trim() !== 'Prolific' && currentNumber > previousNumber) {
            shouldSendNotification = yield getValueFromStorage(SHOW_NOTIFICATION, true);
            if (shouldSendNotification) {
                sendNotification();
            }
            shouldPlayAudio = yield getValueFromStorage(AUDIO_ACTIVE, true);
            if (shouldPlayAudio) {
                audio = yield getValueFromStorage(AUDIO, 'alert1.mp3');
                volume = (yield getValueFromStorage(VOLUME, 100)) / 100;
                yield playAudio(audio, volume);
            }
            yield updateCounterAndBadge(currentNumber - previousNumber);
            // NEW: Also trigger content script to try auto-reserving
            if (tab.id) {
                try {
                    yield chrome.tabs.sendMessage(tab.id, {
                        target: 'content-script',
                        type: 'try-reserve',
                    });
                }
                catch (e) {
                    console.log('[Background] Content script not ready');
                }
            }
        }
    }
}));
// ======================== AUDIO ========================
function playAudio() {
    return __awaiter(this, arguments, void 0, function* (audio = 'alert1.mp3', volume = 1.0) {
        yield setupOffscreenDocument('audio/audio.html');
        const req = {
            audio: audio,
            volume: volume
        };
        yield chrome.runtime.sendMessage({
            type: 'play-sound',
            target: 'offscreen-doc',
            data: req
        });
    });
}
// ======================== NOTIFICATIONS ========================
function sendNotification(customMessage) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL(ICON_URL),
        title: TITLE,
        message: customMessage || MESSAGE,
        buttons: [{ title: 'Open Prolific' }, { title: 'Dismiss' }],
    });
}
// ======================== BADGE ========================
function updateBadge(counter) {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.action.setBadgeText({ text: counter.toString() });
        yield chrome.action.setBadgeBackgroundColor({ color: "#9dec14" });
        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            yield chrome.action.setBadgeText({ text: '' });
        }), 20000);
    });
}
function updateCounterAndBadge() {
    return __awaiter(this, arguments, void 0, function* (count = 1) {
        let counter = (yield getValueFromStorage(COUNTER, 0)) + count;
        yield chrome.storage.sync.set({ [COUNTER]: counter });
        yield updateBadge(count);
    });
}
// ======================== STORAGE ========================
function setInitialValues() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
            chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
            chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
            chrome.storage.sync.set({ [VOLUME]: 100 }),
            chrome.storage.sync.set({ [AUTO_RESERVE]: true }),
        ]);
    });
}
// ======================== OFFSCREEN DOCUMENT ========================
function setupOffscreenDocument(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const offscreenUrl = chrome.runtime.getURL(path);
        const existingContexts = yield chrome.runtime.getContexts({
            contextTypes: [ContextType.OFFSCREEN_DOCUMENT],
            documentUrls: [offscreenUrl]
        });
        if (existingContexts.length > 0) {
            return;
        }
        if (creating) {
            yield creating;
        }
        else {
            creating = chrome.offscreen.createDocument({
                url: path,
                reasons: [Reason.AUDIO_PLAYBACK],
                justification: 'Audio playback'
            });
            yield creating;
            creating = null;
        }
    });
}
// ======================== DYNAMIC SCRIPT INJECTION ========================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    var _a;
    if (changeInfo.status === 'complete' && ((_a = tab.url) === null || _a === void 0 ? void 0 : _a.includes('PROLIFIC_PID='))) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["dist/study-scraper.js"]
        }).catch(e => console.error("Script injection failed:", e));
    }
});
