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
function setVolume(volume) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("volume");
        const vol = result["volume"];
        if (vol !== undefined) {
            volume.value = String(vol);
        }
        volume.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["volume"]: parseFloat(volume.value) });
            });
        });
    });
}
document.addEventListener('DOMContentLoaded', function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.runtime.sendMessage({
            type: 'clear-badge',
            target: 'background',
        });
        const autoAudio = document.getElementById("autoAudio");
        const selectAudio = document.getElementById("selectAudio");
        const counter = document.getElementById("counter");
        const playAudio = document.getElementById("playAudio");
        const showNotification = document.getElementById("showNotification");
        const volume = document.getElementById("volume");
        const openProlific = document.getElementById("openProlific");
        const donateText = document.getElementById('donateText');
        const donateImg = document.getElementById('donateImg');
        // New auto-reserve controls
        const autoReserve = document.getElementById("autoReserve");
        const forceCheck = document.getElementById("forceCheck");
        const statusText = document.getElementById("statusText");
        const reservedCount = document.getElementById("reservedCount");
        if (donateImg && donateText) {
            donateText.addEventListener('mouseover', function () {
                donateImg.style.visibility = 'visible';
            });
        }
        if (autoAudio) {
            yield setAudioCheckbox(autoAudio);
        }
        if (selectAudio) {
            yield setAudioOption(selectAudio);
        }
        if (counter) {
            yield setCounter(counter);
        }
        if (playAudio) {
            playAudio.addEventListener("click", playAlert);
        }
        if (showNotification) {
            yield setShowNotification(showNotification);
        }
        if (openProlific) {
            yield setOpenProlific(openProlific);
        }
        if (volume) {
            yield setVolume(volume);
        }
        // Setup auto-reserve toggle
        if (autoReserve) {
            yield setAutoReserve(autoReserve);
        }
        // Setup force check button
        if (forceCheck) {
            forceCheck.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                forceCheck.disabled = true;
                forceCheck.textContent = '⏳ Checking...';
                forceCheck.classList.remove("btn-success");
                forceCheck.classList.add("btn-fail");
                yield chrome.runtime.sendMessage({
                    type: 'force-check',
                    target: 'background',
                });
                setTimeout(() => {
                    forceCheck.disabled = false;
                    forceCheck.textContent = '🔍 Force Check';
                    forceCheck.classList.remove("btn-fail");
                    forceCheck.classList.add("btn-success");
                }, 2000);
            }));
        }
        // Update status display
        yield updateStatusDisplay(statusText, reservedCount);
        // Refresh status every 2 seconds
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield updateStatusDisplay(statusText, reservedCount);
        }), 2000);
    });
});
function updateStatusDisplay(statusText, reservedCount) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!statusText && !reservedCount)
            return;
        try {
            // Try to get status from content script via tabs
            const tabs = yield chrome.tabs.query({ url: "https://app.prolific.com/*" });
            if (tabs.length > 0 && tabs[0].id) {
                try {
                    const response = yield chrome.tabs.sendMessage(tabs[0].id, {
                        target: 'content-script',
                        type: 'get-status',
                    });
                    if (response) {
                        if (statusText) {
                            statusText.textContent = response.enabled ? '🟢 Active' : '🔴 Disabled';
                            statusText.style.color = response.enabled ? '#00c853' : '#ff1744';
                        }
                        if (reservedCount) {
                            reservedCount.textContent = ((_a = response.reservedCount) === null || _a === void 0 ? void 0 : _a.toString()) || '0';
                        }
                    }
                }
                catch (e) {
                    if (statusText) {
                        statusText.textContent = '⚠️ Content script not loaded';
                        statusText.style.color = '#ff9800';
                    }
                }
            }
            else {
                if (statusText) {
                    statusText.textContent = '⚠️ No Prolific tab open';
                    statusText.style.color = '#ff9800';
                }
            }
        }
        catch (e) {
            // Ignore
        }
    });
}
function setCounter(counter) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("counter");
        const count = result["counter"];
        if (count !== undefined) {
            counter.innerText = count.toString();
        }
    });
}
function playAlert() {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.runtime.sendMessage({
            type: 'play-sound',
            target: 'background',
        });
        const playAudio = document.getElementById("playAudio");
        playAudio.disabled = true;
        playAudio.classList.remove("btn-success");
        playAudio.classList.add("btn-fail");
        setTimeout(() => {
            playAudio.disabled = false;
            playAudio.classList.remove("btn-fail");
            playAudio.classList.add("btn-success");
        }, 500);
    });
}
function setAudioOption(selectAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("audio");
        selectAudio.value = result["audio"];
        selectAudio.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["audio"]: selectAudio.value });
            });
        });
    });
}
function setAudioCheckbox(autoAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("audioActive");
        autoAudio.checked = result["audioActive"];
        autoAudio.addEventListener("click", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["audioActive"]: autoAudio.checked });
            });
        });
    });
}
function setShowNotification(showNotification) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("showNotification");
        showNotification.checked = result["showNotification"];
        showNotification.addEventListener("click", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["showNotification"]: showNotification.checked });
            });
        });
    });
}
function setOpenProlific(openProlific) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("openProlific");
        openProlific.checked = result["openProlific"];
        openProlific.addEventListener("click", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["openProlific"]: openProlific.checked });
            });
        });
    });
}
function setAutoReserve(autoReserve) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("autoReserveEnabled");
        autoReserve.checked = result["autoReserveEnabled"] !== false; // Default to true
        autoReserve.addEventListener("click", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["autoReserveEnabled"]: autoReserve.checked });
                // Notify background to relay to content scripts
                yield chrome.runtime.sendMessage({
                    type: 'toggle-auto-reserve',
                    target: 'background',
                    data: { enabled: autoReserve.checked },
                });
            });
        });
    });
}
