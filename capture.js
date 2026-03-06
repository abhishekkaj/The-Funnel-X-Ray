document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = parseInt(urlParams.get('targetId'));

    if (!targetId || isNaN(targetId)) {
        document.getElementById('status').innerText = 'Error: No valid target tab specified.';
        return;
    }

    const statusEl = document.getElementById('status');
    const canvas = document.getElementById('capture-canvas');
    const ctx = canvas.getContext('2d');
    const downloadControls = document.getElementById('download-controls');

    let frames = [];
    let dpr = 1;

    try {
        // Get our own tab ID so we can return to it later
        const myTab = await new Promise(res => chrome.tabs.getCurrent(res));

        statusEl.innerText = '📸 Pre-scrolling to load images...';

        // Reactivate the target tab so captureVisibleTab captures it instead of this capture.html tab!
        await new Promise(res => chrome.tabs.update(targetId, { active: true }, res));

        await new Promise(res => {
            chrome.tabs.sendMessage(targetId, { action: 'pre_scroll' }, res);
        });

        statusEl.innerText = '📸 Capturing frames...';

        // 1. Prepare: Tame sticky elements and get dimensions
        const dims = await new Promise(res => {
            chrome.tabs.sendMessage(targetId, { action: 'prepare_capture' }, res);
        });

        if (!dims) {
            statusEl.innerText = 'Failed to initialize capture. Please reload the target page.';
            return;
        }

        dpr = dims.devicePixelRatio || 1;
        canvas.width = dims.width * dpr;

        let currentY = 0;
        let drawnBottom = 0;

        // Ensure canvas background is white
        ctx.fillStyle = '#ffffff';

        // Robust while loop for capturing
        while (true) {
            // Mandatory explicit browser repaint delay
            await new Promise(r => setTimeout(r, 250));

            // Capture current viewport from the extension page context looking at the targetId window
            const tabUrlData = await new Promise(res => {
                chrome.tabs.get(targetId, tab => {
                    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, res);
                });
            });

            frames.push({
                dataUrl: tabUrlData,
                y: currentY
            });

            // Scroll down
            const scrollRes = await new Promise(res => {
                chrome.tabs.sendMessage(targetId, { action: 'scroll_next' }, res);
            });

            // Update viewport height in case the window shifted
            if (scrollRes.viewportHeight) dims.viewportHeight = scrollRes.viewportHeight;

            // Kill Switch
            if (Math.abs(scrollRes.currentY - currentY) <= 1) {
                break;
            }

            currentY = scrollRes.currentY;
            canvas.height = scrollRes.fullHeight * dpr;
        }

        statusEl.innerText = '🧵 Stitching ' + frames.length + ' frames together...';

        // Optional: Ensure canvas has a white background after all resizing
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Rendering Engine
        let finalDrawnBottom = 0;
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            await new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => {
                    const skipPixels = Math.max(0, finalDrawnBottom - frame.y);
                    const sourceY = Math.floor(skipPixels * dpr);
                    const sourceHeight = img.height - sourceY;
                    const destY = Math.floor(finalDrawnBottom * dpr);

                    if (sourceHeight > 0) {
                        ctx.drawImage(
                            img,
                            0, sourceY, img.width, sourceHeight,
                            0, destY, img.width, sourceHeight
                        );
                    }
                    finalDrawnBottom = frame.y + dims.viewportHeight;
                    res();
                };
                img.onerror = rej;
                img.src = frame.dataUrl;
            });
        }

        // Final canvas crop if the final drawn height was less than what we allocated
        if (finalDrawnBottom > 0 && Math.floor(finalDrawnBottom * dpr) < canvas.height) {
            const finalHeight = Math.floor(finalDrawnBottom * dpr);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = finalHeight;
            tempCanvas.getContext('2d').drawImage(canvas, 0, 0, canvas.width, finalHeight, 0, 0, canvas.width, finalHeight);

            canvas.height = finalHeight;
            ctx.drawImage(tempCanvas, 0, 0);
        }

        // Done Capturing
        chrome.tabs.sendMessage(targetId, { action: 'cleanup_capture' });

        // Bring the capture.html tab back into focus for the user!
        if (myTab) {
            await new Promise(res => chrome.tabs.update(myTab.id, { active: true }, res));
        }

        statusEl.innerText = '✅ Capture Complete!';
        downloadControls.style.display = 'flex';

    } catch (e) {
        console.error(e);
        statusEl.innerText = 'Error during capture: ' + e.message;
    }

    // Attach Download Listeners
    document.getElementById('download-png-btn').addEventListener('click', downloadPNG);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
});

function downloadPNG() {
    const canvas = document.getElementById('capture-canvas');
    const dataUrl = canvas.toDataURL('image/png');

    // Create an anchor and trigger download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `full-page-${new Date().getTime()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadPDF() {
    const canvas = document.getElementById('capture-canvas');

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF library failed to load!');
        return;
    }

    const { jsPDF } = window.jspdf;

    // PDF dimensions mapping to standard A4 width
    const a4Width = 595.28;

    // Calculate aspect ratio height for the PDF based on the canvas scale
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const ratio = canvasHeight / canvasWidth;
    const pdfHeight = a4Width * ratio;

    // Generate a custom page height so the scroll fits perfectly on one continuous page
    const dynamicPdf = new jsPDF('p', 'pt', [a4Width, pdfHeight]);

    const imgData = canvas.toDataURL('image/png', 0.8);

    dynamicPdf.addImage(imgData, 'PNG', 0, 0, a4Width, pdfHeight, undefined, 'FAST');
    dynamicPdf.save(`full-page-${new Date().getTime()}.pdf`);
}
