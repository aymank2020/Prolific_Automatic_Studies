"use strict";
/**
 * Prolific Study Scraper
 * Runs on third-party study sites to find the completion code early.
 */
// Only run on pages that have PROLIFIC_PID in the URL
const isStudyPage = window.location.href.includes('PROLIFIC_PID=');
const isExcluded = window.location.hostname.includes('prolific.com') || window.location.hostname.includes('whatsapp.com');
if (isStudyPage && !isExcluded) {
    console.log('[Prolific Scraper] Active on study page:', window.location.hostname);
    // Pattern to find 8-character alphanumeric completion codes
    // Matches: cc=C1379C4O, Completion code: C1379C4O, etc.
    const codeRegex = /(?:cc=|completion\s*code\s*[:=]\s*|\"completionCode\"\s*:\s*\")([A-Z0-9]{8})(?![\w])/i;
    let foundCode = null;
    let uiInjected = false;
    // Scan function
    const scanForCode = () => {
        if (foundCode)
            return;
        // 1. Check URL parameters just in case it redirects with it
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('cc')) {
            foundCode = urlParams.get('cc');
        }
        // 2. Check full HTML source (this catches inline script variables like redirect_urls)
        if (!foundCode) {
            const html = document.documentElement.innerHTML;
            const match = html.match(codeRegex);
            if (match && match[1]) {
                foundCode = match[1].toUpperCase();
            }
        }
        if (foundCode && !uiInjected) {
            console.log('[Prolific Scraper] Found Completion Code:', foundCode);
            injectUI(foundCode);
            uiInjected = true;
        }
    };
    // Run initial scan
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scanForCode);
    }
    else {
        scanForCode();
    }
    // Run scan periodically in case of dynamic loading or SPA routing
    setInterval(scanForCode, 2000);
    // Also observe DOM changes
    const observer = new MutationObserver(() => scanForCode());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // UI Injection
    function injectUI(code) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 15px;
            font-weight: 600;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 15px;
            transition: all 0.3s ease;
            cursor: default;
        `;
        const textDiv = document.createElement('div');
        textDiv.innerHTML = `🎯 Prolific Code:<br><span style="font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #facc15;">${code}</span>`;
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'COPY';
        copyBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.4);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;
        copyBtn.onmouseover = () => { copyBtn.style.background = 'rgba(255, 255, 255, 0.3)'; };
        copyBtn.onmouseout = () => { copyBtn.style.background = 'rgba(255, 255, 255, 0.2)'; };
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.textContent = 'COPIED!';
                copyBtn.style.background = '#22c55e';
                copyBtn.style.borderColor = '#22c55e';
                setTimeout(() => {
                    copyBtn.textContent = 'COPY';
                    copyBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                    copyBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                }, 2000);
            });
        };
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: #ef4444;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        closeBtn.onclick = () => container.remove();
        container.appendChild(textDiv);
        container.appendChild(copyBtn);
        container.appendChild(closeBtn);
        document.body.appendChild(container);
    }
}
