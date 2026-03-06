// Background service worker for The Funnel X-Ray
// Handles extension lifecycle and potential background tasks.

chrome.runtime.onInstalled.addListener(() => {
    console.log('The Funnel X-Ray Extension installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_FULL_CAPTURE') {
        runFullPageCapture(request.tabId);
        sendResponse({ success: true });
    }
    return true;
});

async function runFullPageCapture(tabId) {
    let frames = [];

    try {
        // Show capturing overlay
        await chrome.tabs.sendMessage(tabId, { action: 'show_capture_overlay' }).catch(() => { });

        // 1. Pre-scroll and prepare
        await new Promise(res => chrome.tabs.sendMessage(tabId, { action: 'pre_scroll' }, res));
        const dims = await new Promise(res => chrome.tabs.sendMessage(tabId, { action: 'prepare_capture' }, res));

        if (!dims) throw new Error("Could not initialize capture.");

        const dpr = dims.devicePixelRatio || 1;
        let currentY = 0;

        // 2. Main Capture Loop
        while (true) {
            // Wait for repaint
            await new Promise(r => setTimeout(r, 300));

            // Hide the overlay so it isn't captured in the screenshot!
            await chrome.tabs.sendMessage(tabId, { action: 'hide_capture_overlay' }).catch(() => { });
            await new Promise(r => setTimeout(r, 50)); // Allow DOM to apply display:none

            // Capture precise frame using the explicit windowId of the tab
            const dataUrl = await new Promise((res, rej) => {
                chrome.tabs.get(tabId, (tab) => {
                    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (imgStr) => {
                        if (chrome.runtime.lastError) {
                            console.error("Capture error:", chrome.runtime.lastError.message);
                            rej(new Error(chrome.runtime.lastError.message));
                        } else {
                            res(imgStr);
                        }
                    });
                });
            });

            // Re-show the overlay
            await chrome.tabs.sendMessage(tabId, { action: 'show_capture_overlay' }).catch(() => { });

            frames.push({
                dataUrl: dataUrl,
                y: currentY
            });

            // Scroll Next
            const scrollRes = await new Promise(res => {
                chrome.tabs.sendMessage(tabId, { action: 'scroll_next' }, res);
            });

            if (scrollRes.viewportHeight) dims.viewportHeight = scrollRes.viewportHeight;

            // Kill Switch
            if (Math.abs(scrollRes.currentY - currentY) <= 1) {
                break;
            }

            currentY = scrollRes.currentY;
        }

        // Cleanup tab styles
        await chrome.tabs.sendMessage(tabId, { action: 'cleanup_capture' });

        // 3. Save payload securely and open dedicated capture preview tab
        await chrome.storage.local.set({ capturedFrames: frames, captureDims: dims });

        // Remove overlay permanently
        await chrome.tabs.sendMessage(tabId, { action: 'remove_capture_overlay' }).catch(() => { });

        // Open the native capture app
        chrome.tabs.create({ url: "capture.html" });

    } catch (e) {
        console.error("Capture Failed:", e);
        await chrome.tabs.sendMessage(tabId, { action: 'remove_capture_overlay' }).catch(() => { });
    }
}
