async function setVolume(volume: HTMLInputElement) {
    const result = await chrome.storage.sync.get("volume");
    const vol = result["volume"];
    if (vol !== undefined) {
        volume.value =  String(vol);
    }
    volume.addEventListener("change", async function () {
        await chrome.storage.sync.set({["volume"]: parseFloat(volume.value)});
    });

}

document.addEventListener('DOMContentLoaded', async function () {
    await chrome.runtime.sendMessage({
        type: 'clear-badge',
        target: 'background',
    });

    const autoAudio = document.getElementById("autoAudio") as HTMLInputElement;
    const selectAudio = document.getElementById("selectAudio") as HTMLSelectElement;
    const counter = document.getElementById("counter") as HTMLSpanElement;
    const playAudio = document.getElementById("playAudio") as HTMLButtonElement;
    const showNotification = document.getElementById("showNotification") as HTMLInputElement;
    const volume = document.getElementById("volume") as HTMLInputElement;
    const openProlific = document.getElementById("openProlific") as HTMLInputElement;
    const donateText: HTMLElement | null = document.getElementById('donateText');
    const donateImg: HTMLElement | null = document.getElementById('donateImg');

    // New auto-reserve controls
    const autoReserve = document.getElementById("autoReserve") as HTMLInputElement;
    const forceCheck = document.getElementById("forceCheck") as HTMLButtonElement;
    const statusText = document.getElementById("statusText") as HTMLSpanElement;
    const reservedCount = document.getElementById("reservedCount") as HTMLSpanElement;

    if (donateImg && donateText) {
        donateText.addEventListener('mouseover', function() {
            donateImg.style.visibility = 'visible';
        });
    }

    if (autoAudio) {
        await setAudioCheckbox(autoAudio);
    }

    if(selectAudio) {
        await setAudioOption(selectAudio);
    }

    if(counter) {
        await setCounter(counter);
    }

    if(playAudio) {
        playAudio.addEventListener("click", playAlert);
    }

    if(showNotification) {
        await setShowNotification(showNotification);
    }

    if(openProlific) {
        await setOpenProlific(openProlific);
    }

    if (volume) {
        await setVolume(volume);
    }

    // Setup auto-reserve toggle
    if (autoReserve) {
        await setAutoReserve(autoReserve);
    }

    // Setup force check button
    if (forceCheck) {
        forceCheck.addEventListener("click", async () => {
            forceCheck.disabled = true;
            forceCheck.textContent = '⏳ Checking...';
            forceCheck.classList.remove("btn-success");
            forceCheck.classList.add("btn-fail");

            await chrome.runtime.sendMessage({
                type: 'force-check',
                target: 'background',
            });

            setTimeout(() => {
                forceCheck.disabled = false;
                forceCheck.textContent = '🔍 Force Check';
                forceCheck.classList.remove("btn-fail");
                forceCheck.classList.add("btn-success");
            }, 2000);
        });
    }

    // Update status display
    await updateStatusDisplay(statusText, reservedCount);

    // Refresh status every 2 seconds
    setInterval(async () => {
        await updateStatusDisplay(statusText, reservedCount);
    }, 2000);
});

async function updateStatusDisplay(statusText: HTMLSpanElement | null, reservedCount: HTMLSpanElement | null): Promise<void> {
    if (!statusText && !reservedCount) return;

    try {
        // Try to get status from content script via tabs
        const tabs = await chrome.tabs.query({url: "https://app.prolific.com/*"});

        if (tabs.length > 0 && tabs[0].id) {
            try {
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    target: 'content-script',
                    type: 'get-status',
                });

                if (response) {
                    if (statusText) {
                        statusText.textContent = response.enabled ? '🟢 Active' : '🔴 Disabled';
                        statusText.style.color = response.enabled ? '#00c853' : '#ff1744';
                    }
                    if (reservedCount) {
                        reservedCount.textContent = response.reservedCount?.toString() || '0';
                    }
                }
            } catch (e) {
                if (statusText) {
                    statusText.textContent = '⚠️ Content script not loaded';
                    statusText.style.color = '#ff9800';
                }
            }
        } else {
            if (statusText) {
                statusText.textContent = '⚠️ No Prolific tab open';
                statusText.style.color = '#ff9800';
            }
        }
    } catch (e) {
        // Ignore
    }
}

async function setCounter(counter: HTMLSpanElement): Promise<void> {
    const result = await chrome.storage.sync.get("counter");
    const count = result["counter"];
    if (count !== undefined) {
        counter.innerText = count.toString();
    }
}

async function playAlert(): Promise<void> {
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'background',
    });
    const playAudio = document.getElementById("playAudio") as HTMLButtonElement;
    playAudio.disabled = true;
    playAudio.classList.remove("btn-success");
    playAudio.classList.add("btn-fail");
    setTimeout(() => {
        playAudio.disabled = false;
        playAudio.classList.remove("btn-fail");
        playAudio.classList.add("btn-success");
    }, 500);
}

async function setAudioOption(selectAudio: HTMLSelectElement): Promise<void> {
    const result = await chrome.storage.sync.get("audio");
    selectAudio.value = result["audio"];
    selectAudio.addEventListener("change", async function (): Promise<void> {
        await chrome.storage.sync.set({["audio"]: selectAudio.value});
    });
}

async function setAudioCheckbox(autoAudio: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("audioActive");
    autoAudio.checked = result["audioActive"];
    autoAudio.addEventListener("click", async function (): Promise<void> {
        await chrome.storage.sync.set({["audioActive"]: autoAudio.checked});
    });
}

async function setShowNotification(showNotification: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("showNotification");
    showNotification.checked = result["showNotification"];
    showNotification.addEventListener("click", async function (): Promise<void> {
        await chrome.storage.sync.set({["showNotification"]: showNotification.checked});
    });
}

async function setOpenProlific(openProlific: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("openProlific");
    openProlific.checked = result["openProlific"];
    openProlific.addEventListener("click", async function (): Promise<void> {
        await chrome.storage.sync.set({["openProlific"]: openProlific.checked});
    });
}

async function setAutoReserve(autoReserve: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("autoReserveEnabled");
    autoReserve.checked = result["autoReserveEnabled"] !== false; // Default to true
    autoReserve.addEventListener("click", async function (): Promise<void> {
        await chrome.storage.sync.set({["autoReserveEnabled"]: autoReserve.checked});

        // Notify background to relay to content scripts
        await chrome.runtime.sendMessage({
            type: 'toggle-auto-reserve',
            target: 'background',
            data: { enabled: autoReserve.checked },
        });
    });
}
