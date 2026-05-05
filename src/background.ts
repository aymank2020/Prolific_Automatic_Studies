import Reason = chrome.offscreen.Reason;
import ContextType = chrome.runtime.ContextType;

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
let creating: Promise<void> | null;
let volume: number;
let audio: string;
let shouldSendNotification: boolean;
let shouldPlayAudio: boolean;
let previousTitle: string;

// ======================== API POLLING (Background) ========================
const API_BASE = 'https://internal-api.prolific.com/api/v1';
const POLL_ALARM_NAME = 'prolific-api-poll';
const FAST_POLL_ALARM_NAME = 'prolific-fast-poll';

// ======================== MESSAGE HANDLERS ========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessages(message, sender, sendResponse);
    return true; // Needed for async sendResponse
});

chrome.notifications.onClicked.addListener(function (notificationId: string): void {
    chrome.tabs.create({url: "https://app.prolific.com/studies", active: true});
    chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(function (notificationId: string, buttonIndex: number): void {
    if (buttonIndex === 0) {
        chrome.tabs.create({url: "https://app.prolific.com/studies", active: true});
    }
    chrome.notifications.clear(notificationId);
});

// ======================== INSTALLATION ========================
chrome.runtime.onInstalled.addListener(async (details: { reason: string; }): Promise<void> => {
    if(details.reason === "install"){
        await setInitialValues();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await chrome.tabs.create({url: "https://github.com/aymank2020/Prolific_Automatic_Studies", active: true});
    }
    // Set up alarms for periodic checking
    setupAlarms();
});

// ======================== STARTUP ========================
chrome.runtime.onStartup.addListener(async function(): Promise<void> {
    if (await getValueFromStorage(OPEN_PROLIFIC, false)) {
        await chrome.tabs.create({url: "https://app.prolific.com/studies", active: false});
    }
    setupAlarms();
});

// ======================== ALARMS ========================
function setupAlarms(): void {
    // Regular poll every 30 seconds
    chrome.alarms.create(POLL_ALARM_NAME, {
        periodInMinutes: 0.5, // 30 seconds
    });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === POLL_ALARM_NAME) {
        await checkProlificTab();
    }
    if (alarm.name === FAST_POLL_ALARM_NAME) {
        await triggerContentScriptCheck();
    }
});

// ======================== UTILITY FUNCTIONS ========================
function getValueFromStorage<T>(key: string, defaultValue: T): Promise<T> {
    return new Promise((resolve): void => {
        chrome.storage.sync.get(key, function (result): void {
            resolve((result[key] !== undefined) ? result[key] as T : defaultValue);
        });
    });
}

function getNumberFromTitle(title: string): number {
    const match: RegExpMatchArray | null = title.match(/\((\d+)\)/);
    return match ? parseInt(match[1]) : 0;
}

// ======================== MESSAGE HANDLER ========================
async function handleMessages(message: { target: string; type: any; data?: any; }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): Promise<void> {
    if (message.target !== 'background') {
        return;
    }

    switch (message.type) {
        case 'play-sound':
            audio = await getValueFromStorage(AUDIO, 'alert1.mp3');
            volume = await getValueFromStorage(VOLUME, 100) / 100;
            await playAudio(audio, volume);
            sendNotification();
            break;

        case 'show-notification':
            sendNotification();
            break;

        case 'clear-badge':
            await chrome.action.setBadgeText({text: ''});
            break;

        // New: Study detected by content script
        case 'studies-detected':
            console.log('[Background] Studies detected:', message.data);
            await handleStudiesDetected(message.data);
            break;

        // New: Study reserved by content script
        case 'study-reserved':
            console.log('[Background] Study reserved:', message.data);
            await handleStudyReserved(message.data);
            if (message.data?.count) {
                await addToHistory(message.data);
            }
            break;

        // New: Toggle auto-reserve
        case 'toggle-auto-reserve':
            const enabled = message.data?.enabled ?? true;
            await chrome.storage.sync.set({[AUTO_RESERVE]: enabled});
            // Forward to content script
            await broadcastToContentScripts({
                target: 'content-script',
                type: 'toggle-auto-reserve',
                data: { enabled },
            });
            break;

        // New: Force check from popup
        case 'force-check':
            await triggerContentScriptCheck();
            break;

        // New: Get status from content scripts
        case 'get-status':
            // This will be handled via sendResponse in the listener
            break;

        // WhatsApp: Open study link from WhatsApp monitor
        case 'open-study-link':
            console.log('[Background] Opening study from WhatsApp:', message.data?.url);
            if (message.data?.url) {
                await chrome.tabs.create({ url: message.data.url, active: true });
                // Play sound alert
                shouldPlayAudio = await getValueFromStorage(AUDIO_ACTIVE, true);
                if (shouldPlayAudio) {
                    audio = await getValueFromStorage(AUDIO, 'alert1.mp3');
                    volume = await getValueFromStorage(VOLUME, 100) / 100;
                    await playAudio(audio, volume);
                }
                // Send notification
                sendNotification(`📱 Study from WhatsApp! Opening: ${message.data.studyId || 'unknown'}`);
            }
            break;

        // WhatsApp: Study found notification
        case 'whatsapp-study-found':
            console.log('[Background] WhatsApp study found:', message.data);
            shouldSendNotification = await getValueFromStorage(SHOW_NOTIFICATION, true);
            if (shouldSendNotification) {
                sendNotification(`📱 New study link from WhatsApp! ID: ${message.data?.studyId || 'unknown'}`);
            }
            break;

        case 'close-tab':
            console.log('[Background] Closing tab as requested by content script:', sender.tab?.id);
            if (sender.tab?.id) {
                chrome.tabs.remove(sender.tab.id).catch(e => console.error("Failed to close tab:", e));
            }
            break;

        // AI Auto-Solver: Solve Question
        case 'solve-question':
            try {
                const answer = await queryAI(message.data.userPrompt, message.data.systemPrompt);
                sendResponse(answer);
            } catch (error) {
                console.error('[Background] AI Solve Error:', error);
                sendResponse(null);
            }
            break;
    }
}

async function addToHistory(data: any) {
    try {
        const history: any[] = await getValueFromStorage<any[]>('studyHistory', []);
        
        let studyInfo = data.study || {};
        
        history.unshift({
            timestamp: Date.now(),
            count: data.count || 1,
            id: data.id || studyInfo.id || 'unknown',
            title: studyInfo.name || 'Unknown Study',
            researcher: studyInfo.researcher?.name || 'Unknown Researcher',
            pay: studyInfo.reward || 0,
            payPerHour: studyInfo.estimated_reward_per_hour || 0,
            duration: studyInfo.estimated_completion_time || 0,
            places: studyInfo.total_available_places || 0,
            source: data.source || 'auto'
        });
        // Keep only last 50 studies for a richer history
        if (history.length > 50) history.length = 50;
        await chrome.storage.local.set({ studyHistory: history });
    } catch (e) {}
}

// ======================== STUDY HANDLERS ========================
async function handleStudiesDetected(data: any): Promise<void> {
    shouldSendNotification = await getValueFromStorage(SHOW_NOTIFICATION, true);
    if (shouldSendNotification) {
        sendNotification(data?.count ? `${data.count} studies available!` : undefined);
    }

    shouldPlayAudio = await getValueFromStorage(AUDIO_ACTIVE, true);
    if (shouldPlayAudio) {
        audio = await getValueFromStorage(AUDIO, 'alert1.mp3');
        volume = await getValueFromStorage(VOLUME, 100) / 100;
        await playAudio(audio, volume);
    }

    // Update badge
    if (data?.count) {
        await updateBadge(data.count);
    }

    // Bring Prolific tab to front
    await focusProlificTab();
}

async function handleStudyReserved(data: any): Promise<void> {
    const count = data?.count || 1;
    await updateCounterAndBadge(count);

    // Send success notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL(ICON_URL),
        title: '🎉 Study Reserved!',
        message: `Successfully reserved ${count} study/studies!`,
        buttons: [{title: 'Open Prolific'}, {title: 'Dismiss'}],
    });

    // Play success sound
    shouldPlayAudio = await getValueFromStorage(AUDIO_ACTIVE, true);
    if (shouldPlayAudio) {
        audio = await getValueFromStorage(AUDIO, 'alert1.mp3');
        volume = await getValueFromStorage(VOLUME, 100) / 100;
        await playAudio(audio, volume);
    }
}

// ======================== PROLIFIC TAB MANAGEMENT ========================

/**
 * Find the active Prolific tab
 */
async function findProlificTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({url: "https://app.prolific.com/*"});
    return tabs.length > 0 ? tabs[0] : null;
}

/**
 * Focus the Prolific tab
 */
async function focusProlificTab(): Promise<void> {
    const tab = await findProlificTab();
    if (tab && tab.id) {
        try {
            await chrome.tabs.update(tab.id, {active: true});
            if (tab.windowId) {
                await chrome.windows.update(tab.windowId, {focused: true});
            }
        } catch (e) {
            console.log('[Background] Could not focus tab:', e);
        }
    }
}

/**
 * Check the Prolific tab status periodically
 */
async function checkProlificTab(): Promise<void> {
    const tab = await findProlificTab();
    if (!tab) return;

    // If the tab title indicates studies available, trigger notification
    if (tab.title) {
        const currentNumber = getNumberFromTitle(tab.title);
        if (currentNumber > 0) {
            console.log(`[Background] Alarm check: ${currentNumber} studies detected from title`);
            await handleStudiesDetected({ count: currentNumber, source: 'alarm' });
        }
    }
}

/**
 * Send a message to all content scripts on Prolific tabs
 */
async function broadcastToContentScripts(message: any): Promise<void> {
    const tabs = await chrome.tabs.query({url: "https://app.prolific.com/*"});
    for (const tab of tabs) {
        if (tab.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, message);
            } catch (e) {
                // Content script may not be ready
            }
        }
    }
}

/**
 * Trigger content script to check for studies immediately
 */
async function triggerContentScriptCheck(): Promise<void> {
    await broadcastToContentScripts({
        target: 'content-script',
        type: 'force-check',
    });
}

// ======================== TAB LISTENER (Original + Enhanced) ========================
chrome.tabs.onUpdated.addListener(async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> => {
    // 1. Dynamic Script Injection for External Study Sites
    if (changeInfo.status === 'complete' && tab.url?.includes('PROLIFIC_PID=')) {
        // Inject Scraper
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["dist/study-scraper.js"]
        }).catch(e => console.error("Scraper injection failed:", e));

        // Inject AI Solver if enabled
        const aiEnabled = await getValueFromStorage('aiEnabled', false);
        if (aiEnabled) {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["dist/study-solver.js"]
            }).catch(e => console.error("AI Solver injection failed:", e));
        }
    }

    // 2. Prolific Title Monitoring
    previousTitle = await getValueFromStorage(PROLIFIC_TITLE, 'Prolific');

    if (tab.url && tab.url.includes('https://app.prolific.com/') && changeInfo.title && changeInfo.title !== previousTitle && tab.status === 'complete') {
        const previousNumber: number = getNumberFromTitle(previousTitle);
        const currentNumber: number = getNumberFromTitle(changeInfo.title);
        await chrome.storage.sync.set({[PROLIFIC_TITLE]: changeInfo.title});

        if (changeInfo.title.trim() !== 'Prolific' && currentNumber > previousNumber) {
            shouldSendNotification = await getValueFromStorage(SHOW_NOTIFICATION, true);
            if (shouldSendNotification) {
                sendNotification();
            }

            shouldPlayAudio = await getValueFromStorage(AUDIO_ACTIVE, true);
            if (shouldPlayAudio) {
                audio = await getValueFromStorage(AUDIO, 'alert1.mp3');
                volume = await getValueFromStorage(VOLUME, 100) / 100;
                await playAudio(audio, volume);
            }

            await updateCounterAndBadge(currentNumber - previousNumber);

            // NEW: Also trigger content script to try auto-reserving
            if (tab.id) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        target: 'content-script',
                        type: 'try-reserve',
                    });
                } catch (e) {
                    console.log('[Background] Content script not ready');
                }
            }
        }
    }
});

// ======================== AUDIO ========================
async function playAudio(audio: string = 'alert1.mp3', volume: number = 1.0): Promise<void> {
    await setupOffscreenDocument('audio/audio.html');
    const req = {
        audio: audio,
        volume: volume
    };
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'offscreen-doc',
        data: req
    });
}

// ======================== NOTIFICATIONS ========================
function sendNotification(customMessage?: string): void {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL(ICON_URL),
        title: TITLE,
        message: customMessage || MESSAGE,
        buttons: [{title: 'Open Prolific'}, {title: 'Dismiss'}],
    });
}

// ======================== BADGE ========================
async function updateBadge(counter: number): Promise<void> {
    await chrome.action.setBadgeText({text: counter.toString()});
    await chrome.action.setBadgeBackgroundColor({color: "#9dec14"});

    setTimeout(async (): Promise<void> => {
        await chrome.action.setBadgeText({text: ''});
    }, 20000);
}

async function updateCounterAndBadge(count: number = 1): Promise<void> {
    let counter: number = await getValueFromStorage(COUNTER, 0) + count;
    await chrome.storage.sync.set({ [COUNTER]: counter });
    await updateBadge(count);
}

// ======================== STORAGE ========================
async function setInitialValues(): Promise<void> {
    await Promise.all([
        chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
        chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
        chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
        chrome.storage.sync.set({ [VOLUME]: 100 }),
        chrome.storage.sync.set({ [AUTO_RESERVE]: true }),
    ]);
}

// ======================== OFFSCREEN DOCUMENT ========================
async function setupOffscreenDocument(path: string): Promise<void> {
    const offscreenUrl: string = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [Reason.AUDIO_PLAYBACK],
            justification: 'Audio playback'
        });
        await creating;
        creating = null;
    }
}

// ======================== AI FUNCTIONS ========================
async function queryAI(userPrompt: string, systemPrompt: string): Promise<string> {
    const apiKey = await getValueFromStorage('aiApiKey', '');
    const baseUrl = await getValueFromStorage('aiBaseUrl', 'https://api.openai.com/v1');
    const model = await getValueFromStorage('aiModel', 'gpt-4o-mini');

    if (!apiKey) return 'NO_API_KEY';

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`AI API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// End of Background Script
