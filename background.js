// Background service worker for The Funnel X-Ray
// Handles extension lifecycle and potential background tasks.

chrome.runtime.onInstalled.addListener(() => {
    console.log('The Funnel X-Ray Extension installed.');
});
