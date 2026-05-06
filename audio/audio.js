// Listen for messages from the extension
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
    // Return early if this message isn't meant for the offscreen document.
    if (message.target !== 'offscreen-doc') {
        return;
    }

    // Dispatch the message to an appropriate handler.
    switch (message.type) {
        case 'play-sound':
            await playSound(message.data);
            break;
    }
}

async function playSound(data) {
    try {
        if (typeof data !== 'object' || !('audio' in data) || !('volume' in data)) {
            throw new TypeError(`Invalid sound data`);
        }
        
        // Use relative path from extension root
        const source = chrome.runtime.getURL('audio/' + data.audio);
        const audio = new Audio(source);
        audio.volume = data.volume;
        await audio.play();
        console.log('[Offscreen] Playing:', data.audio);
    } catch (error) {
        console.error('[Offscreen] Audio error:', error);
    }
}
