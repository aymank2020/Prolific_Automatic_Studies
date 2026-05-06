/**
 * WhatsApp Web Monitor for Prolific Study Links
 * ================================================
 * Monitors WhatsApp Web for Prolific study links in group chats
 * and immediately opens them for auto-reservation.
 *
 * Target groups: AI Training 2, AI Training 3, Prolific تنبيهات,
 * Prolific Exclusive Leaders, Ai Jobs& Websites V3, etc.
 */
// @ts-ignore: Isolated scope
// ======================== CONFIGURATION ========================
const WA_CONFIG = {
    // Pattern to match Prolific study URLs
    PROLIFIC_URL_PATTERN: /https?:\/\/app\.prolific\.com\/studies\/[a-f0-9]+/gi,
    // Alternative patterns (some links may have query params)
    PROLIFIC_URL_PATTERN_FULL: /https?:\/\/app\.prolific\.com\/studies\/[a-f0-9]+(\?[^\s"'<>)}\]]*)?/gi,
    // How often to scan for new messages (ms)
    SCAN_INTERVAL: 500,
    // Debounce for mutation observer (ms)
    MUTATION_DEBOUNCE: 100,
    // Storage key for processed links
    PROCESSED_LINKS_KEY: 'processedProlificLinks',
    // Maximum age for a link to be auto-opened (ms) - 5 minutes
    MAX_LINK_AGE: 5 * 60 * 1000,
    // Log prefix
    LOG_PREFIX: '📱 [WA-Prolific Monitor]',
    // Sound notification
    PLAY_SOUND: true,
    // Auto-open links
    AUTO_OPEN: true,
    // Maximum links to track (prevent memory leak)
    MAX_TRACKED_LINKS: 500,
    // WhatsApp message selectors
    MESSAGE_SELECTORS: [
        '[data-testid="msg-container"]',
        '.message-in',
        '._amjw',
        '._amjv',
        '[class*="message"]',
        'div[data-id]',
    ],
    // WhatsApp link selectors inside messages
    LINK_SELECTORS: [
        'a[href*="app.prolific.com"]',
        'a[href*="prolific.com/studies"]',
        '[data-testid="link-preview"]',
        'a.selectable-text',
        'span.selectable-text a',
    ],
    // Text content selectors (for links in plain text)
    TEXT_SELECTORS: [
        'span.selectable-text',
        'span[dir="ltr"]',
        'span[dir="auto"]',
        '.copyable-text',
        '._ao3e', // WhatsApp text content class
    ],
};
// ======================== STATE ========================
let processedLinks = new Set();
let waObserver = null;
let scanTimer = null;
let lastScanTime = 0;
let waIsEnabled = true;
let linkCount = 0;
let isInitialLoad = true; // Prevents auto-opening old links when DOM renders initially
// ======================== LOGGING ========================
function waLog(...args) {
    console.log(WA_CONFIG.LOG_PREFIX, ...args);
}
// ======================== LINK EXTRACTION ========================
/**
 * Extract all Prolific study URLs from a text string
 */
function extractProlificLinks(text) {
    if (!text)
        return [];
    const links = [];
    const matches = text.match(WA_CONFIG.PROLIFIC_URL_PATTERN_FULL);
    if (matches) {
        for (const match of matches) {
            // Normalize the URL (remove trailing punctuation, query params for dedup)
            const cleanUrl = match.replace(/[.,;:!?)}\]]+$/, '');
            const baseUrl = cleanUrl.split('?')[0]; // Base URL without query params
            if (baseUrl && !links.includes(baseUrl)) {
                links.push(baseUrl);
            }
        }
    }
    return links;
}
/**
 * Extract study ID from a Prolific URL
 */
function extractStudyId(url) {
    const match = url.match(/\/studies\/([a-f0-9]+)/i);
    return match ? match[1] : null;
}
// ======================== MESSAGE SCANNING ========================
/**
 * Scan all visible messages for Prolific links
 */
function scanForProlificLinks() {
    const foundLinks = [];
    // Method 1: Find direct <a> links to Prolific
    for (const selector of WA_CONFIG.LINK_SELECTORS) {
        try {
            const links = document.querySelectorAll(selector);
            links.forEach(link => {
                const href = link.href || link.getAttribute('href') || '';
                const extracted = extractProlificLinks(href);
                foundLinks.push(...extracted);
            });
        }
        catch (e) { }
    }
    // Method 2: Search text content for Prolific URLs (plain text links)
    for (const selector of WA_CONFIG.TEXT_SELECTORS) {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent || '';
                if (text.includes('prolific.com')) {
                    const extracted = extractProlificLinks(text);
                    foundLinks.push(...extracted);
                }
            });
        }
        catch (e) { }
    }
    // Method 3: Search ALL anchor tags inside the active chat container only (Performance Fix)
    const chatContainer = document.querySelector('#main') || document;
    const allLinks = chatContainer.querySelectorAll('a[href*="prolific.com/studies/"]');
    allLinks.forEach(link => {
        const href = link.href || '';
        if (href.includes('prolific.com/studies/')) {
            const extracted = extractProlificLinks(href);
            foundLinks.push(...extracted);
        }
    });
    // Deduplicate
    return [...new Set(foundLinks)];
}
/**
 * Process newly discovered links
 */
function processNewLinks(links) {
    for (const link of links) {
        const studyId = extractStudyId(link);
        if (!studyId)
            continue;
        // Skip if already processed
        if (processedLinks.has(studyId))
            continue;
        // Mark as processed
        processedLinks.add(studyId);
        linkCount++;
        // Trim processed links set if too large
        if (processedLinks.size > WA_CONFIG.MAX_TRACKED_LINKS) {
            const arr = Array.from(processedLinks);
            processedLinks = new Set(arr.slice(-200)); // Keep last 200
        }
        waLog(`🆕 New Prolific study link detected: ${link}`);
        waLog(`📋 Study ID: ${studyId}`);
        // Save to storage
        saveLinkToStorage(studyId, link);
        // Auto-open the link (ONLY if not during initial load)
        if (waIsEnabled && WA_CONFIG.AUTO_OPEN) {
            if (isInitialLoad) {
                waLog(`🤫 Initial load phase - silently tracking study ID: ${studyId}`);
            }
            else {
                openStudyLink(link, studyId);
            }
        }
        // Notify background script
        waNotifyBg('whatsapp-study-found', {
            url: link,
            studyId: studyId,
            timestamp: Date.now(),
        });
    }
}
// ======================== LINK ACTIONS ========================
/**
 * Open a study link in a new tab with focus
 */
function openStudyLink(url, studyId) {
    waLog(`🚀 Opening study: ${url}`);
    // Method 1: Send to background to open tab (preferred - handles focus)
    try {
        chrome.runtime.sendMessage({
            target: 'background',
            type: 'open-study-link',
            data: {
                url: url,
                studyId: studyId,
            },
        });
    }
    catch (e) {
        // Fallback: open directly
        waLog('⚠️ Background unavailable, opening directly');
        window.open(url, '_blank');
    }
    // Play notification sound
    playDetectionSound();
    // Show visual flash notification in WhatsApp
    showInPageNotification(studyId, url);
}
/**
 * Play a quick beep/notification sound
 */
function playDetectionSound() {
    try {
        chrome.runtime.sendMessage({
            target: 'background',
            type: 'play-sound',
        });
    }
    catch (e) {
        // Fallback: simple beep
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.3;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        }
        catch (e2) { }
    }
}
/**
 * Show a visual notification banner in WhatsApp
 */
function showInPageNotification(studyId, url) {
    // Remove any existing notification
    const existing = document.getElementById('prolific-wa-notification');
    if (existing)
        existing.remove();
    const notification = document.createElement('div');
    notification.id = 'prolific-wa-notification';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">🚀</span>
            <div>
                <strong>Prolific Study Detected!</strong><br>
                <small>Study ${studyId.substring(0, 8)}... → Opening & reserving...</small>
            </div>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1565c0, #0d47a1);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 9999999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        animation: slideDown 0.3s ease-out, fadeOut 0.5s ease-in 4s forwards;
        cursor: pointer;
    `;
    // Add animation styles
    if (!document.getElementById('prolific-wa-styles')) {
        const style = document.createElement('style');
        style.id = 'prolific-wa-styles';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
            @keyframes fadeOut {
                to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }
    // Click to open the link
    notification.addEventListener('click', () => {
        window.open(url, '_blank');
        notification.remove();
    });
    document.body.appendChild(notification);
    // Auto-remove after 5 seconds
    setTimeout(() => notification.remove(), 5000);
}
// ======================== STORAGE ========================
function saveLinkToStorage(studyId, url) {
    try {
        chrome.storage.local.get(WA_CONFIG.PROCESSED_LINKS_KEY, (result) => {
            const links = result[WA_CONFIG.PROCESSED_LINKS_KEY] || {};
            links[studyId] = {
                url: url,
                timestamp: Date.now(),
                opened: true,
            };
            chrome.storage.local.set({ [WA_CONFIG.PROCESSED_LINKS_KEY]: links });
        });
    }
    catch (e) { }
}
function loadProcessedLinks() {
    try {
        chrome.storage.local.get(WA_CONFIG.PROCESSED_LINKS_KEY, (result) => {
            const links = result[WA_CONFIG.PROCESSED_LINKS_KEY] || {};
            for (const studyId of Object.keys(links)) {
                processedLinks.add(studyId);
            }
            waLog(`📂 Loaded ${processedLinks.size} previously processed links`);
        });
    }
    catch (e) { }
}
// ======================== MUTATION OBSERVER ========================
/**
 * Watch for new messages being added to the chat
 */
function setupWAObserver() {
    if (waObserver) {
        waObserver.disconnect();
    }
    let debounceTimer = null;
    waObserver = new MutationObserver((mutations) => {
        let hasNewContent = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLElement) {
                        const text = node.textContent || '';
                        // Quick check: does this contain anything Prolific-related?
                        if (text.includes('prolific') || text.includes('Prolific') ||
                            text.includes('app.prolific.com')) {
                            hasNewContent = true;
                            break;
                        }
                        // Also check for any links
                        const links = node.querySelectorAll('a[href*="prolific"]');
                        if (links.length > 0) {
                            hasNewContent = true;
                            break;
                        }
                    }
                }
            }
            if (hasNewContent)
                break;
        }
        if (hasNewContent) {
            if (debounceTimer)
                clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                waLog('🔔 New Prolific-related content detected in WhatsApp!');
                const links = scanForProlificLinks();
                processNewLinks(links);
            }, WA_CONFIG.MUTATION_DEBOUNCE);
        }
    });
    // Observe the entire app for changes
    const target = document.getElementById('app') || document.body;
    waObserver.observe(target, {
        childList: true,
        subtree: true,
    });
    waLog('👁️ WhatsApp MutationObserver active');
}
// ======================== POLLING ========================
function waStartPolling() {
    if (scanTimer)
        clearInterval(scanTimer);
    scanTimer = setInterval(() => {
        const links = scanForProlificLinks();
        if (links.length > 0) {
            processNewLinks(links);
        }
    }, WA_CONFIG.SCAN_INTERVAL);
    waLog(`🔄 Polling started (${WA_CONFIG.SCAN_INTERVAL}ms interval)`);
}
// ======================== MESSAGE LISTENER ========================
function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.target !== 'whatsapp-monitor')
            return;
        switch (message.type) {
            case 'get-wa-status':
                sendResponse({
                    enabled: waIsEnabled,
                    processedCount: processedLinks.size,
                    totalFound: linkCount,
                    isMonitoring: waObserver !== null,
                });
                break;
            case 'toggle-wa-monitor':
                waIsEnabled = message.data?.enabled ?? !waIsEnabled;
                waLog(`Monitor ${waIsEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
                sendResponse({ enabled: waIsEnabled });
                break;
            case 'force-scan':
                const links = scanForProlificLinks();
                processNewLinks(links);
                sendResponse({ found: links.length });
                break;
        }
    });
}
// ======================== STATUS INDICATOR ========================
function addWAStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'prolific-wa-indicator';
    indicator.innerHTML = '📱';
    indicator.title = 'Prolific WhatsApp Monitor Active';
    indicator.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(37, 211, 102, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        z-index: 999999;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        animation: wa-pulse 2s infinite;
    `;
    if (!document.getElementById('prolific-wa-indicator-styles')) {
        const style = document.createElement('style');
        style.id = 'prolific-wa-indicator-styles';
        style.textContent = `
            @keyframes wa-pulse {
                0%, 100% { box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3); }
                50% { box-shadow: 0 2px 16px rgba(37, 211, 102, 0.6); }
            }
            #prolific-wa-indicator:hover {
                transform: scale(1.2);
            }
            #prolific-wa-indicator.disabled {
                background: rgba(150, 150, 150, 0.9);
                animation: none;
            }
        `;
        document.head.appendChild(style);
    }
    indicator.addEventListener('click', () => {
        waIsEnabled = !waIsEnabled;
        indicator.classList.toggle('disabled', !waIsEnabled);
        indicator.title = waIsEnabled
            ? `Prolific Monitor Active (${linkCount} links found)`
            : 'Prolific Monitor Disabled (click to enable)';
        waLog(`Monitor toggled: ${waIsEnabled}`);
    });
    document.body.appendChild(indicator);
}
// ======================== INITIALIZATION ========================
function initWAMonitor() {
    waLog('🚀 Initializing WhatsApp Prolific Monitor...');
    waLog(`📍 URL: ${window.location.href}`);
    // Load previously processed links
    loadProcessedLinks();
    // Setup all monitoring mechanisms
    setupMessageListener();
    setupWAObserver();
    waStartPolling();
    addWAStatusIndicator();
    // Initial scan and grace period for initial DOM rendering
    setTimeout(() => {
        const links = scanForProlificLinks();
        waLog(`📊 Initial scan: ${links.length} Prolific links found`);
        // On first load, don't auto-open old links - just mark them
        links.forEach(link => {
            const studyId = extractStudyId(link);
            if (studyId)
                processedLinks.add(studyId);
        });
        // End initial load phase after WhatsApp has had time to render old messages
        setTimeout(() => {
            isInitialLoad = false;
            waLog('✅ Initial load phase completed. Auto-open is now active.');
        }, 5000); // 5 seconds is enough to allow old messages to render
    }, 2000);
    waLog('✅ WhatsApp Monitor active!');
    waLog('   - MutationObserver: ON');
    waLog(`   - Polling (${WA_CONFIG.SCAN_INTERVAL}ms): ON`);
    waLog('   - Link detection: ON');
}
// ======================== BACKGROUND COMMUNICATION ========================
function waNotifyBg(type, data) {
    try {
        chrome.runtime.sendMessage({
            target: 'background',
            type: type,
            data: data,
        });
    }
    catch (e) {
        waLog('⚠️ Could not notify background:', e);
    }
}
// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWAMonitor);
}
else {
    // WhatsApp Web loads dynamically, wait a bit for the app to initialize
    setTimeout(initWAMonitor, 3000);
}
