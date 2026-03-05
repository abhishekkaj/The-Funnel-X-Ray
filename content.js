// content.js - Injected into the active tab to extract diagnostic data

function getWordPressData() {
    const html = document.documentElement.outerHTML;

    // Extract Themes using robust regex
    const themeRegex = /\/wp-content\/themes\/([^/"\']+)/g;
    const themes = new Set();
    let match;
    while ((match = themeRegex.exec(html)) !== null) {
        themes.add(match[1]);
    }

    // Extract Plugins using robust regex
    const pluginRegex = /\/wp-content\/plugins\/([^/"\']+)/g;
    const plugins = new Set();
    while ((match = pluginRegex.exec(html)) !== null) {
        plugins.add(match[1]);
    }

    const generatorMeta = document.querySelector('meta[name="generator"]');
    const isWordPress = html.includes('/wp-content/') || (generatorMeta && generatorMeta.content.toLowerCase().includes('wordpress'));

    return {
        isWordPress,
        themes: Array.from(themes),
        plugins: Array.from(plugins)
    };
}

function getSeoData() {
    const title = document.title || '';
    const metaDescTag = document.querySelector('meta[name="description"]');
    const metaDesc = metaDescTag ? metaDescTag.content : '';
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const canonicalUrl = canonicalTag ? canonicalTag.href : '';

    const h1Tags = Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim()).filter(text => text);
    const h2Tags = Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim()).filter(text => text);

    // Keyword Density Calculate with Stop-Words Array
    const stopWords = new Set([
        "the", "and", "is", "in", "it", "to", "of", "for", "on", "with", "as", "by", "this", "that", "are",
        "a", "an", "be", "or", "from", "at", "not", "but", "was", "we", "will", "you", "your", "can", "has",
        "have", "more", "our", "all", "about", "which", "their", "they", "there", "what", "so", "if", "out",
        "up", "do", "how", "who", "when", "where", "why", "some", "any", "no", "just", "like", "then", "than"
    ]);

    // Extract visible body text, convert to lower case, and strip punctuation
    const bodyText = document.body.innerText || '';
    const words = bodyText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);

    const wordCounts = {};
    for (const word of words) {
        if (word.length > 2 && !stopWords.has(word) && isNaN(word)) { // Filter out short words, stop words, and numbers
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    }

    const topKeywords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => ({ word: entry[0], count: entry[1] }));

    return {
        title,
        metaDesc,
        canonicalUrl,
        h1Tags,
        h2Tags,
        topKeywords
    };
}

function getFacebookPixelData() {
    const html = document.documentElement.outerHTML;

    const pixelIds = new Set();

    // Match fbq('init', 'ID')
    const initRegex = /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]\s*\)/g;
    let match;
    while ((match = initRegex.exec(html)) !== null) {
        pixelIds.add(match[1]);
    }

    // Match <noscript> tracking img src (finding facebook.com/tr?id=)
    const allImgs = document.querySelectorAll('noscript img, img');
    for (const img of allImgs) {
        const src = img.getAttribute('src');
        if (src && src.includes('facebook.com/tr?id=')) {
            const urlObj = new URL(src, window.location.origin);
            const id = urlObj.searchParams.get('id');
            if (id) pixelIds.add(id);
        }
    }

    // Also do a manual string match for noscript blocks just in case it's not parsed properly in the DOM
    const noscriptRegex = /<noscript>[\s\S]*?facebook\.com\/tr\?id=(\d+)[\s\S]*?<\/noscript>/g;
    while ((match = noscriptRegex.exec(html)) !== null) {
        pixelIds.add(match[1]);
    }

    // Cleaned hostname for Ads Library
    let hostname = window.location.hostname;
    hostname = hostname.replace(/^(www\.)?(http:\/\/)?(https:\/\/)?/i, '');

    const adsLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(hostname)}`;

    return {
        pixelIds: Array.from(pixelIds),
        adsLibraryUrl,
        hostname
    };
}

// We can send this over via message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyze_page') {
        const data = {
            wp: getWordPressData(),
            seo: getSeoData(),
            fb: getFacebookPixelData()
        };
        sendResponse(data);
    }
    return true; // Keep message channel open for async if needed in the future
});
