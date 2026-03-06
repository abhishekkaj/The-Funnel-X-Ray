// content.js - Injected into the active tab to extract diagnostic data

// Global variable for Full Page Capture sticky element restoration
window.originalStyles = [];
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

function getEcommerceData() {
    const html = document.documentElement.outerHTML;

    // Check Platforms
    const isShopify = !!window.Shopify || html.includes('cdn.shopify.com');

    // WooCommerce fallback checks
    const hasWooClass = document.body && (document.body.classList.contains('woocommerce') || document.body.classList.contains('woocommerce-page'));
    const hasWooVar = /wc_add_to_cart_params|woocommerce_params/.test(html);
    const wooGenerator = document.querySelector('meta[name="generator"]');
    const hasWooMeta = wooGenerator && wooGenerator.content && wooGenerator.content.toLowerCase().includes('woocommerce');
    const hasWooPath = html.includes('/wp-content/plugins/woocommerce/');
    const isWooCommerce = hasWooClass || hasWooVar || hasWooMeta || hasWooPath;

    const isMagento = !!document.querySelector('meta[name="generator"][content*="Magento"]') || html.includes('Mage.Cookies');

    let platforms = [];
    if (isShopify) platforms.push('Shopify');
    if (isWooCommerce) platforms.push('WooCommerce');
    if (isMagento) platforms.push('Magento');

    // Check Schema
    let products = [];
    const schemas = document.querySelectorAll('script[type="application/ld+json"]');
    schemas.forEach(script => {
        try {
            const parsed = JSON.parse(script.innerText);
            let items = Array.isArray(parsed) ? parsed : [parsed];
            items.forEach(item => {
                if (item['@graph']) {
                    item['@graph'].forEach(g => items.push(g));
                }
                if (item['@type'] === 'Product') {
                    let price = null;
                    let currency = null;

                    if (item.offers) {
                        const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                        if (offers.length > 0) {
                            price = offers[0].price || null;
                            currency = offers[0].priceCurrency || null;
                        }
                    }
                    if (price && currency) {
                        products.push({ price, currency, name: item.name || 'Unknown Product' });
                    }
                }
            });
        } catch (e) {
            // Ignored
        }
    });

    const uniqueProducts = [];
    const seen = new Set();
    products.forEach(p => {
        const key = `${p.name}-${p.price}-${p.currency}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueProducts.push(p);
        }
    });

    return { platforms, products: uniqueProducts };
}

function getOmnichannelData() {
    const html = document.documentElement.outerHTML;

    const fbIds = new Set();
    const gtmIds = new Set();
    const ga4Ids = new Set();
    const tiktokIds = new Set();
    const linkedinIds = new Set();

    let match;

    const fbInitRegex = /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]\s*\)/g;
    while ((match = fbInitRegex.exec(html)) !== null) fbIds.add(match[1]);
    const fbNoscriptRegex = /facebook\.com\/tr\?id=(\d+)/g;
    while ((match = fbNoscriptRegex.exec(html)) !== null) fbIds.add(match[1]);

    const gtmRegex = /(GTM-[A-Z0-9]+)/g;
    while ((match = gtmRegex.exec(html)) !== null) gtmIds.add(match[1]);

    const ga4Regex = /(G-[A-Z0-9]+)/g;
    while ((match = ga4Regex.exec(html)) !== null) ga4Ids.add(match[1]);

    const tiktokRegex = /ttq\.load\(['"]([^'"]+)['"]\)/g;
    while ((match = tiktokRegex.exec(html)) !== null) tiktokIds.add(match[1]);

    const linkedinPartnerRegex = /_linkedin_partner_id\s*=\s*['"]([^'"]+)['"]/g;
    while ((match = linkedinPartnerRegex.exec(html)) !== null) linkedinIds.add(match[1]);

    let hostname = window.location.hostname;
    hostname = hostname.replace(/^(www\.)?(http:\/\/)?(https:\/\/)?/i, '');
    const adsLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(hostname)}`;

    return {
        fb: Array.from(fbIds),
        gtm: Array.from(gtmIds),
        ga4: Array.from(ga4Ids),
        tiktok: Array.from(tiktokIds),
        linkedin: Array.from(linkedinIds),
        adsLibraryUrl,
        hostname
    };
}

function getAssetsData() {
    const html = document.documentElement.outerHTML;

    const iframes = Array.from(document.querySelectorAll('iframe'));
    const interactiveEmbeds = [];
    iframes.forEach(iframe => {
        const src = iframe.src || '';
        if (src && !src.includes('doubleclick') && !src.includes('facebook') && !src.includes('google')) {
            interactiveEmbeds.push(src);
        }
    });

    const providers = new Set();
    const forms = Array.from(document.querySelectorAll('form'));
    forms.forEach(form => {
        const action = (form.action || '').toLowerCase();
        if (action.includes('mailchimp') || action.includes('list-manage')) providers.add('Mailchimp');
        if (action.includes('klaviyo')) providers.add('Klaviyo');
        if (action.includes('activecampaign')) providers.add('ActiveCampaign');
    });

    if (html.toLowerCase().includes('klaviyo_subscribe.js')) providers.add('Klaviyo');

    return {
        iframes: interactiveEmbeds,
        emailProviders: Array.from(providers)
    };
}

function getDesignSystem() {
    const typography = new Set();
    const colors = {};
    const assets = [];

    // 1. Extract Typography
    const extractFont = (selector) => {
        try {
            const el = document.querySelector(selector);
            if (el) {
                const styles = window.getComputedStyle(el);
                if (styles.fontFamily) {
                    // Clean up the font string
                    const primaryFont = styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
                    if (primaryFont) typography.add(primaryFont);
                }
            }
        } catch (e) { }

        // If element doesn't exist, we fallback to body style manually
        if (selector === 'body' && typography.size === 0) {
            try {
                const bodyStyles = window.getComputedStyle(document.body);
                if (bodyStyles && bodyStyles.fontFamily) {
                    const primaryFont = bodyStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
                    if (primaryFont) typography.add(primaryFont);
                }
            } catch (e) { }
        }
    };

    extractFont('body');
    extractFont('h1');
    extractFont('h2');

    // 2. Extract Color Palette
    const htmlContent = document.documentElement.innerHTML || '';
    // Regex for 3 or 6 char hex codes
    const hexRegex = /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/gi;
    let match;

    // Ignore pure black, white, and transparency equivalents
    const ignoreList = new Set(['#ffffff', '#fff', '#000000', '#000', '#transparent']);

    while ((match = hexRegex.exec(htmlContent)) !== null) {
        let hex = match[0].toLowerCase();
        // Normalize 3-char hex to 6-char
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        if (!ignoreList.has(hex)) {
            colors[hex] = (colors[hex] || 0) + 1;
        }
    }

    // Sort by frequency, take top 10
    const topColors = Object.entries(colors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    // 3. Extract Visual Assets (Images)
    const images = document.querySelectorAll('img');
    const assetSet = new Set();

    images.forEach(img => {
        if (img.src) {
            const src = img.src;
            // Filter out base64, tiny trackers (often 1x1), SVG icons (sometimes)
            if (!src.startsWith('data:image') && Math.max(img.width, img.naturalWidth || 0) > 30) {
                assetSet.add(src);
            }
        }
    });

    const topAssets = Array.from(assetSet).slice(0, 10);

    return {
        typography: Array.from(typography),
        colors: topColors,
        assets: topAssets,
        totalAssetsFound: assetSet.size
    };
}

async function getHiddenFunnels() {
    const hiddenUrls = new Set();
    const keywords = ['offer', 'upsell', 'checkout', 'oto', 'thank-you', 'success'];

    const checkTextForKeywords = (text) => {
        // Extract all URLs from the text
        const urlRegex = /(https?:\/\/[^\s"'<]+)/g;
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
            const url = match[1].toLowerCase();
            // Check if URL contains any keyword
            if (keywords.some(kw => url.includes(kw))) {
                hiddenUrls.add(match[1]); // Add original case
            }
        }
    };

    try {
        const sitemapRes = await fetch('/sitemap.xml');
        if (sitemapRes.ok) checkTextForKeywords(await sitemapRes.text());
    } catch (e) { /* Ignore */ }

    try {
        const robotsRes = await fetch('/robots.txt');
        if (robotsRes.ok) checkTextForKeywords(await robotsRes.text());
    } catch (e) { /* Ignore */ }

    return Array.from(hiddenUrls);
}

// We can send this over via message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyze_page') {
        // Handle asynchronously
        (async () => {
            const data = {
                wp: getWordPressData(),
                seo: getSeoData(),
                ecommerce: getEcommerceData(),
                omni: getOmnichannelData(),
                assets: getAssetsData(),
                design: getDesignSystem(),
                hiddenFunnels: await getHiddenFunnels()
            };
            sendResponse(data);
        })();
        return true; // Keep message channel open for async response
    }

    if (request.action === 'pre_scroll') {
        (async () => {
            let previousY = -1;
            while (true) {
                const currentY = window.scrollY || document.documentElement.scrollTop;
                if (currentY === previousY) break;
                previousY = currentY;
                window.scrollBy(0, window.innerHeight);
                await new Promise(r => setTimeout(r, 100));
            }
            window.scrollTo(0, 0);
            await new Promise(r => setTimeout(r, 300));
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'prepare_capture') {
        window.originalStyles = [];
        const elements = document.querySelectorAll('*');

        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'sticky') {
                window.originalStyles.push({
                    element: el,
                    cssText: el.style.cssText
                });
                el.style.setProperty('position', 'absolute', 'important');
            }
        });

        // Hide scrollbar temporarily
        const originalOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        window.originalStyles.push({
            element: document.documentElement,
            isRoot: true,
            overflow: originalOverflow
        });

        window.scrollTo(0, 0);

        // Small delay to ensure paint
        setTimeout(() => {
            sendResponse({
                width: document.documentElement.scrollWidth,
                height: getFullHeight(),
                viewportHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            });
        }, 150);
        return true;
    }

    if (request.action === 'scroll_next') {
        const previousY = window.scrollY || document.documentElement.scrollTop;
        window.scrollBy(0, window.innerHeight);

        setTimeout(() => {
            const currentY = window.scrollY || document.documentElement.scrollTop;

            sendResponse({
                previousY: previousY,
                currentY: currentY,
                fullHeight: getFullHeight(),
                viewportHeight: window.innerHeight
            });
        }, 300); // 300ms delay to allow images and lazy loads to paint
        return true;
    }

    if (request.action === 'cleanup_capture') {
        window.originalStyles.forEach(item => {
            if (item.element) {
                if (item.isRoot) {
                    item.element.style.overflow = item.overflow;
                } else {
                    item.element.style.cssText = item.cssText;
                }
            }
        });
        window.originalStyles = [];
        window.scrollTo(0, 0);
        sendResponse({ success: true });
        return false;
    }
});
