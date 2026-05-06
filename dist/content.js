/**
 * Prolific Auto-Reserve Content Script v2
 * Targets: https://app.prolific.com/*
 *
 * From screenshots we know:
 * - Reserve button text: "Take part in this study"
 * - 404 page: "404 – Page Not Found" with Home/Support buttons
 * - Study full error: "The study is full and therefore submissions can't be accepted"
 * - Study cards in left sidebar with title, researcher, pay, duration, places
 * - Nav: Studies | Submissions | About you | Messages
 */
// @ts-ignore: Isolated scope
const CONFIG = {
    // "Take part in this study" is the EXACT button text from screenshots
    RESERVE_BUTTON_TEXT: [
        'take part in this study',
        'take part',
        'reserve a place',
        'reserve place',
        'reserve',
        'accept',
        'start study',
    ],
    RESERVE_BUTTON_SELECTORS: [
        'button[data-testid="take-part-button"]',
        'button[data-testid="reserve-place-button"]',
        'button[data-testid="accept-study-button"]',
        'button[data-testid="start-study-button"]',
        'a[data-testid="study-card-action"]',
    ],
    STUDY_CARD_SELECTORS: [
        '[data-testid="study-card"]',
        '[class*="StudyCard"]',
        '[class*="study-card"]',
        'a[href*="/studies/"]',
    ],
    // Error detection
    STUDY_FULL_TEXT: [
        'study is full',
        'submissions can\'t be accepted',
        'no places available',
        'no more places',
        'study has been paused',
        'study has ended',
    ],
    LIMITED_CAPACITY_TEXT: [
        'only allows',
        'at a time',
        'currently full',
        'try again soon',
        'limited capacity'
    ],
    RATE_LIMIT_TEXT: [
        '429',
        'too many requests',
        'unusually high activity',
        'access to studies have been limited',
    ],
    POLL_INTERVAL: 2000,
    FAST_POLL_INTERVAL: 800,
    FAST_POLL_DURATION: 8000,
    MUTATION_DEBOUNCE: 1000,
    API_PATTERN: 'internal-api.prolific.com/api/v1',
    LOG_PREFIX: '🚀 [Prolific Auto-Reserve]',
};
let isEnabled = true;
let knownStudyIds = new Set();
let reservedStudyIds = new Set();
let knownStudiesData = new Map();
let lastStudyCount = 0;
let fastPollTimer = null;
let pollTimer = null;
let observer = null;
let startTime = Date.now();
function log(...args) { console.log(CONFIG.LOG_PREFIX, ...args); }
function isTargetPage() {
    // Only run aggressively on the studies page or individual study pages
    return window.location.pathname.startsWith('/studies');
}
// ======================== 404 & ERROR HANDLING ========================
function check404AndRedirect() {
    const bodyText = document.body?.textContent || '';
    if (bodyText.includes('404') && bodyText.includes('Page Not Found')) {
        const isSpecificStudy = getStudyIdFromUrl() !== null;
        if (isSpecificStudy) {
            log('🔴 404 detected on specific study! Closing tab...');
            notifyBg('close-tab');
        }
        else {
            log('🔴 404 detected! Redirecting to studies page...');
            window.location.href = 'https://app.prolific.com/studies';
        }
        return true;
    }
    return false;
}
function checkStudyFull() {
    const bodyText = (document.body?.textContent || '').toLowerCase();
    // First, check for LIMITED CAPACITY (Temporary)
    for (const text of CONFIG.LIMITED_CAPACITY_TEXT) {
        if (bodyText.includes(text)) {
            log(`🟡 Limited Capacity detected: "${text}". Waiting to retry...`);
            handleLimitedCapacity();
            return true;
        }
    }
    // Then, check for PERMANENTLY FULL
    for (const text of CONFIG.STUDY_FULL_TEXT) {
        if (bodyText.includes(text)) {
            const isSpecificStudy = getStudyIdFromUrl() !== null;
            if (isSpecificStudy) {
                log(`🔴 Study is full: "${text}". Closing tab...`);
                // Wait a moment so user sees what happened, then close
                setTimeout(() => {
                    notifyBg('close-tab');
                }, 1500);
            }
            else {
                log(`🔴 Study is full: "${text}". Redirecting to studies page...`);
                setTimeout(() => {
                    window.location.href = 'https://app.prolific.com/studies';
                }, 1500);
            }
            return true;
        }
    }
    return false;
}
let limitedCapacityTimer = null;
function handleLimitedCapacity() {
    if (limitedCapacityTimer)
        return;
    updateIndicator('warn', 'Limited Capacity - Retrying...');
    // Strategy: Try to click the 'Start study' button every 10 seconds
    // or refresh every 30 seconds if button not found
    let attempts = 0;
    limitedCapacityTimer = setInterval(() => {
        attempts++;
        log(`🔄 Limited Capacity Retry #${attempts}`);
        const buttons = findReserveButtons();
        if (buttons.length > 0) {
            log('🎯 Found Start button, clicking...');
            buttons[0].click();
        }
        else if (attempts % 3 === 0) {
            log('🔄 Refreshing page to clear error state...');
            window.location.reload();
        }
    }, 10000);
}
function checkRateLimit() {
    const pageText = document.body.innerText.toLowerCase();
    for (const pattern of CONFIG.RATE_LIMIT_TEXT) {
        if (pageText.includes(pattern)) {
            log('🚨 RATE LIMIT DETECTED! Pausing all automation...');
            notifyBg('rate-limit-detected');
            isEnabled = false;
            if (observer)
                observer.disconnect();
            if (fastPollTimer)
                clearInterval(fastPollTimer);
            return true;
        }
    }
    return false;
}
// ======================== BUTTON DETECTION ========================
function findReserveButtons() {
    const buttons = [];
    const seen = new Set();
    // Method 1: CSS selectors
    for (const sel of CONFIG.RESERVE_BUTTON_SELECTORS) {
        try {
            document.querySelectorAll(sel).forEach(el => {
                const h = el;
                if (!seen.has(h) && isVisible(h) && !h.hasAttribute('disabled')) {
                    seen.add(h);
                    buttons.push(h);
                }
            });
        }
        catch (e) { }
    }
    // Method 2: Text content scan (most reliable based on screenshots)
    document.querySelectorAll('button, a[role="button"], [role="button"]').forEach(el => {
        const h = el;
        if (seen.has(h))
            return;
        const text = (h.textContent || '').toLowerCase().trim();
        for (const pattern of CONFIG.RESERVE_BUTTON_TEXT) {
            if (text.includes(pattern) && isVisible(h) && !h.hasAttribute('disabled')) {
                seen.add(h);
                buttons.push(h);
                break;
            }
        }
    });
    return buttons;
}
function isVisible(el) {
    if (!el)
        return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && el.offsetParent !== null;
}
// ======================== AUTO-RESERVE ========================
function tryAutoReserve() {
    if (!isEnabled)
        return 0;
    const t0 = Date.now();
    const buttons = findReserveButtons();
    if (buttons.length === 0)
        return 0;
    let clicked = 0;
    for (const btn of buttons) {
        const id = getStudyIdFromUrl() || getStudyIdFromElement(btn) || `btn-${clicked}`;
        if (reservedStudyIds.has(id))
            continue;
        log(`🎯 Clicking reserve button: "${btn.textContent?.trim()}"`);
        try {
            // Multiple click methods for React compatibility
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            btn.click();
            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
            reservedStudyIds.add(id);
            clicked++;
            const studyData = knownStudiesData.get(id) || null;
            notifyBg('study-reserved', {
                count: 1,
                id: id,
                timestamp: Date.now(),
                study: studyData
            });
            log(`🎉 Reserved study ${id} in ${Date.now() - t0}ms`);
        }
        catch (e) {
            log('❌ Click error:', e);
        }
    }
    // If we didn't find the 'Take part' button directly, try clicking a study card first
    if (clicked === 0) {
        const cards = findStudyCards();
        for (const card of cards) {
            const h = card;
            // Don't click if we already know it
            if (!h.dataset.botClicked) {
                log(`🖱️ Clicking study card to reveal reserve button...`);
                try {
                    h.click();
                    h.dataset.botClicked = "true";
                    // We return 0 here because we haven't reserved it yet. 
                    // Fast polling will catch the 'Take part' button when it renders.
                }
                catch (e) { }
                break; // Only click one at a time
            }
        }
    }
    if (clicked > 0) {
        // Find the last clicked id (rough approximation since we might click multiple, but usually it's 1)
        // If there's multiple, we'll just log the count, but for history we want the data of the ones we just reserved
        // Actually, let's just use the id if it exists.
        // In tryAutoReserve we loop and can send individual events per study.
        // We already do btn.click() loop. 
    }
    return clicked;
}
function getStudyIdFromUrl() {
    const m = window.location.href.match(/\/studies\/([a-f0-9]+)/i);
    return m ? m[1] : null;
}
function getStudyIdFromElement(el) {
    const link = el.closest('a[href*="/studies/"]') || el.querySelector('a[href*="/studies/"]');
    if (link) {
        const match = link.getAttribute('href')?.match(/\/studies\/([a-f0-9]+)/i);
        return match ? match[1] : null;
    }
    return null;
}
function findStudyCards() {
    const cards = [];
    const seen = new Set();
    for (const sel of CONFIG.STUDY_CARD_SELECTORS) {
        try {
            document.querySelectorAll(sel).forEach(el => {
                if (!seen.has(el)) {
                    seen.add(el);
                    cards.push(el);
                }
            });
        }
        catch (e) { }
    }
    return cards;
}
function extractStudyDataFromCard(card) {
    try {
        const titleEl = card.querySelector('h3, .title, [class*="title"]');
        const researcherEl = card.querySelector('.researcher, [class*="researcher"]');
        const rewardEl = card.querySelector('.reward, [class*="reward"], .pay');
        // Find study ID from any link inside the card
        const link = card.querySelector('a[href*="/studies/"]');
        const idMatch = link?.getAttribute('href')?.match(/\/studies\/([a-f0-9]+)/i);
        const id = idMatch ? idMatch[1] : `dom-${Math.floor(Math.random() * 1000)}`;
        return {
            id,
            name: titleEl?.textContent?.trim() || 'Unknown Study',
            researcher: { name: researcherEl?.textContent?.trim() || 'Unknown Researcher' },
            reward: rewardEl?.textContent?.trim() ? parseFloat(rewardEl.textContent.replace(/[^0-9.]/g, '')) * 100 : 0,
            url: link ? (window.location.origin + link.getAttribute('href')) : null
        };
    }
    catch (e) {
        return null;
    }
}
// ======================== STUDY DETECTION ========================
function onStudyDetected(source) {
    if (!isTargetPage())
        return;
    if (checkRateLimit())
        return;
    log(`🔔 Study detected via ${source}!`);
    if (checkStudyFull())
        return;
    // Try to extract data for ALL current study cards for history
    const cards = findStudyCards();
    const detectedStudies = cards.map(c => extractStudyDataFromCard(c)).filter(d => d !== null);
    const clicked = tryAutoReserve();
    if (clicked > 0) {
        log(`✅ Auto-reserved ${clicked} studies via ${source}`);
    }
    else {
        startFastPolling();
    }
    // Notify background with the study data we found
    if (detectedStudies.length > 0) {
        for (const study of detectedStudies) {
            // Only notify if we haven't already notified for this exact study recently
            if (!knownStudyIds.has(study.id)) {
                knownStudyIds.add(study.id);
                notifyBg('studies-detected', {
                    source,
                    count: detectedStudies.length,
                    id: study.id,
                    study: study
                });
            }
        }
    }
    else {
        // Fallback for simple count notification if no specific data extracted
        const currentCount = cards.length;
        if (currentCount > lastStudyCount) {
            notifyBg('studies-detected', { source, count: currentCount });
            lastStudyCount = currentCount;
        }
    }
}
function startFastPolling() {
    const end = Date.now() + CONFIG.FAST_POLL_DURATION;
    if (fastPollTimer)
        clearInterval(fastPollTimer);
    fastPollTimer = setInterval(() => {
        if (Date.now() > end) {
            clearInterval(fastPollTimer);
            fastPollTimer = null;
            return;
        }
        if (checkStudyFull()) {
            clearInterval(fastPollTimer);
            fastPollTimer = null;
            return;
        }
        const c = tryAutoReserve();
        if (c > 0) {
            clearInterval(fastPollTimer);
            fastPollTimer = null;
        }
    }, CONFIG.FAST_POLL_INTERVAL);
}
// ======================== MUTATION OBSERVER ========================
function setupObserver() {
    if (observer)
        observer.disconnect();
    let debounce = null;
    observer = new MutationObserver((mutations) => {
        let relevant = false;
        for (const m of mutations) {
            if (m.type === 'childList' && m.addedNodes.length > 0) {
                for (const node of Array.from(m.addedNodes)) {
                    if (node instanceof HTMLElement) {
                        const t = (node.textContent || '').toLowerCase();
                        if (t.includes('take part') || t.includes('reserve') || t.includes('study') ||
                            t.includes('£') || t.includes('$') || t.includes('places') ||
                            t.includes('404') || t.includes('page not found')) {
                            relevant = true;
                            break;
                        }
                    }
                }
            }
            if (m.type === 'attributes' && m.target instanceof HTMLElement &&
                m.attributeName === 'disabled' && m.target.tagName === 'BUTTON') {
                relevant = true;
            }
            if (relevant)
                break;
        }
        if (relevant) {
            if (debounce)
                clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (!isTargetPage())
                    return;
                if (!check404AndRedirect())
                    onStudyDetected('mutation');
            }, CONFIG.MUTATION_DEBOUNCE);
        }
    });
    const target = document.getElementById('app') || document.body;
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class'] });
    log('👁️ MutationObserver active');
}
// ======================== API INTERCEPTION ========================
function interceptFetch() {
    const orig = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
        const response = await orig.apply(this, args);
        if (url.includes(CONFIG.API_PATTERN) && url.includes('stud')) {
            try {
                const clone = response.clone();
                const data = await clone.json();
                const studies = data?.results || (Array.isArray(data) ? data : null);
                if (studies?.length > 0) {
                    log(`📡 API: ${studies.length} studies from fetch`);
                    let newCount = 0;
                    for (const s of studies) {
                        const id = s.id || s.study_id;
                        if (id) {
                            if (!knownStudyIds.has(id)) {
                                knownStudyIds.add(id);
                                newCount++;
                            }
                            knownStudiesData.set(id, s);
                        }
                    }
                    if (newCount > 0 && isTargetPage())
                        onStudyDetected('api-fetch');
                }
            }
            catch (e) { }
        }
        return response;
    };
    log('🔌 Fetch interceptor installed');
}
function interceptXHR() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._pUrl = url.toString();
        return origOpen.apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        const url = this._pUrl || '';
        if (url.includes(CONFIG.API_PATTERN) && url.includes('stud')) {
            this.addEventListener('load', function () {
                try {
                    const data = JSON.parse(this.responseText);
                    const studies = data?.results || (Array.isArray(data) ? data : null);
                    if (studies?.length > 0) {
                        log(`📡 API: ${studies.length} studies from XHR`);
                        let n = 0;
                        for (const s of studies) {
                            const id = s.id || s.study_id;
                            if (id) {
                                if (!knownStudyIds.has(id)) {
                                    knownStudyIds.add(id);
                                    n++;
                                }
                                knownStudiesData.set(id, s);
                            }
                        }
                        if (n > 0 && isTargetPage())
                            onStudyDetected('api-xhr');
                    }
                }
                catch (e) { }
            });
        }
        return origSend.apply(this, args);
    };
    log('🔌 XHR interceptor installed');
}
// ======================== NAVIGATION & AUTO-REFRESH ========================
function setupNavMonitor() {
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            log(`🔀 Navigation: ${lastUrl}`);
            if (lastUrl.includes('/studies')) {
                setTimeout(() => { if (!check404AndRedirect())
                    onStudyDetected('nav'); }, 200);
                setTimeout(() => { if (!check404AndRedirect())
                    onStudyDetected('nav-delay'); }, 800);
            }
        }
    }).observe(document, { subtree: true, childList: true });
    const origPush = history.pushState;
    history.pushState = function (...args) {
        origPush.apply(this, args);
        setTimeout(() => {
            if (location.href.includes('/studies') && !check404AndRedirect())
                onStudyDetected('pushState');
        }, 200);
    };
}
function setupAutoRefresh() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isTargetPage()) {
            log('👁️ Tab visible, checking...');
            if (!check404AndRedirect() && !checkStudyFull())
                onStudyDetected('visibility');
        }
    });
}
function startPolling() {
    if (pollTimer)
        clearTimeout(pollTimer);
    const runPoll = () => {
        if (checkRateLimit() || check404AndRedirect())
            return;
        const cards = findStudyCards();
        if (cards.length > lastStudyCount) {
            log(`📊 Poll: ${lastStudyCount} → ${cards.length} studies`);
            lastStudyCount = cards.length;
            onStudyDetected('poll');
        }
        else if (cards.length > 0) {
            tryAutoReserve();
        }
        lastStudyCount = cards.length;
        // Schedule next poll with jitter (2-4 seconds)
        const nextInterval = CONFIG.POLL_INTERVAL + (Math.random() * 2000);
        pollTimer = setTimeout(runPoll, nextInterval);
    };
    pollTimer = setTimeout(runPoll, CONFIG.POLL_INTERVAL);
}
// ======================== COMMUNICATION ========================
function notifyBg(type, data) {
    try {
        chrome.runtime.sendMessage({ target: 'background', type, data });
    }
    catch (e) { }
}
function setupMessages() {
    chrome.runtime.onMessage.addListener((msg, _s, respond) => {
        if (msg.target !== 'content-script')
            return;
        switch (msg.type) {
            case 'toggle-auto-reserve':
                isEnabled = msg.data?.enabled ?? !isEnabled;
                respond({ enabled: isEnabled });
                break;
            case 'get-status':
                respond({ enabled: isEnabled, studyCount: findStudyCards().length,
                    reservedCount: reservedStudyIds.size, knownStudies: knownStudyIds.size,
                    uptime: Date.now() - startTime, currentUrl: location.href });
                break;
            case 'force-check':
                if (!check404AndRedirect())
                    onStudyDetected('manual');
                respond({ checked: true });
                break;
            case 'try-reserve':
                respond({ clicked: tryAutoReserve() });
                break;
        }
    });
}
// ======================== VISUAL INDICATOR ========================
function addIndicator() {
    const el = document.createElement('div');
    el.id = 'prolific-auto-indicator';
    el.innerHTML = '🚀';
    el.title = 'Auto-Reserve Active';
    el.style.cssText = `position:fixed;bottom:10px;right:10px;width:32px;height:32px;border-radius:50%;
        background:rgba(0,200,83,0.9);display:flex;align-items:center;justify-content:center;
        font-size:16px;z-index:999999;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);
        transition:all 0.3s;animation:pulse-g 2s infinite;`;
    const css = document.createElement('style');
    css.textContent = `@keyframes pulse-g{0%,100%{box-shadow:0 2px 8px rgba(0,200,83,0.3)}
        50%{box-shadow:0 2px 16px rgba(0,200,83,0.6)}}
        #prolific-auto-indicator:hover{transform:scale(1.2)}
        #prolific-auto-indicator.off{background:rgba(200,50,50,0.9);animation:none}`;
    document.head.appendChild(css);
    el.addEventListener('click', () => {
        isEnabled = !isEnabled;
        el.classList.toggle('off', !isEnabled);
    });
    document.body.appendChild(el);
}
function updateIndicator(type, text) {
    const el = document.getElementById('prolific-auto-indicator');
    if (!el)
        return;
    el.title = text;
    if (type === 'warn') {
        el.style.background = 'rgba(255,152,0,0.9)';
        el.innerHTML = '⏳';
    }
    else if (type === 'error') {
        el.style.background = 'rgba(244,67,54,0.9)';
        el.innerHTML = '⚠️';
    }
    else {
        el.style.background = 'rgba(0,200,83,0.9)';
        el.innerHTML = '🚀';
    }
}
// ======================== INIT ========================
function init() {
    log('🚀 Initializing v2...');
    // ALWAYS setup message handling so the popup can get status
    setupMessages();
    // Check if we are on the correct page (ignore side tabs like settings, account)
    if (!isTargetPage()) {
        log('⏸️ Not on /studies page, bot sleeping but listening for messages.');
        setupNavMonitor(); // Only monitor navigation so we can wake up if they go to /studies
        return;
    }
    // Immediate: check for 404
    if (check404AndRedirect())
        return;
    // Load prefs
    try {
        chrome.storage.sync.get('autoReserveEnabled', (r) => {
            if (r.autoReserveEnabled !== undefined)
                isEnabled = r.autoReserveEnabled;
        });
    }
    catch (e) { }
    interceptFetch();
    interceptXHR();
    setupObserver();
    setupNavMonitor();
    setupAutoRefresh();
    startPolling();
    addIndicator();
    // Initial check after page settles
    setTimeout(() => {
        if (checkRateLimit())
            return;
        if (check404AndRedirect())
            return;
        checkStudyFull();
        const cards = findStudyCards();
        lastStudyCount = cards.length;
        log(`📊 Initial: ${cards.length} cards, URL: ${location.href}`);
        // If on a specific study page, immediately try to reserve
        if (getStudyIdFromUrl()) {
            log('📋 On study detail page, trying immediate reserve...');
            onStudyDetected('initial-study-page');
        }
        else if (cards.length > 0) {
            onStudyDetected('initial');
        }
    }, 500);
    log('✅ All systems active!');
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
