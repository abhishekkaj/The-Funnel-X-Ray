document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status');
    const canvas = document.getElementById('capture-canvas');
    const ctx = canvas.getContext('2d');
    const downloadControls = document.getElementById('download-controls');

    try {
        statusEl.innerText = '⚙️ Finalizing capture rendering...';

        const data = await new Promise(res => chrome.storage.local.get(['capturedFrames', 'captureDims'], res));

        if (!data.capturedFrames || !data.captureDims) {
            statusEl.innerText = 'Error: Capture data not found in sandbox memory. Please try again.';
            return;
        }

        const frames = data.capturedFrames;
        const dims = data.captureDims;
        const dpr = dims.devicePixelRatio || 1;

        canvas.width = dims.width * dpr;

        // Calculate the maximum actual canvas height needed
        let maxCanvasHeight = 0;
        frames.forEach(frame => {
            maxCanvasHeight = Math.max(maxCanvasHeight, frame.y + dims.viewportHeight);
        });
        // We ensure canvas height accommodates the full height the background script observed
        canvas.height = Math.max(dims.height * dpr, maxCanvasHeight * dpr);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        statusEl.innerText = '🧵 Stitching ' + frames.length + ' seamless frames together...';

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

        // Flush heavy memory from background storage immediately
        chrome.storage.local.remove(['capturedFrames', 'captureDims']);

        statusEl.innerText = '✅ Capture Complete!';

        // Hide spinner
        const spinner = document.getElementById('status-spinner');
        if (spinner) spinner.style.display = 'none';

        downloadControls.style.display = 'flex';

    } catch (e) {
        console.error(e);
        statusEl.innerText = 'Error during stitching: ' + e.message;
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
