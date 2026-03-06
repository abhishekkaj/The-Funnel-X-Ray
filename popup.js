document.addEventListener('DOMContentLoaded', () => {
    // Accordion Logic
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', function () {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            this.setAttribute('aria-expanded', !isExpanded);
            const content = this.nextElementSibling;
            if (!isExpanded) {
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                content.style.maxHeight = null;
            }
        });
    });

    // Fetch data from current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || typeof tabs[0] === 'undefined') {
            displayError('No active tab found.');
            return;
        }

        const activeTab = tabs[0];
        if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
            displayError('Cannot inspect browser pages.');
            return;
        }

        // Initial Message Passing
        chrome.tabs.sendMessage(activeTab.id, { action: 'analyze_page' }, (response) => {
            if (chrome.runtime.lastError) {
                // If content script isn't loaded (e.g. freshly installed extension on an existing tab), inject it
                chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    files: ['content.js']
                }).then(() => {
                    // Try again
                    chrome.tabs.sendMessage(activeTab.id, { action: 'analyze_page' }, (retryResponse) => {
                        if (chrome.runtime.lastError) {
                            displayError('Could not analyze page. Please refresh the tab and try again.');
                        } else {
                            renderData(retryResponse);
                        }
                    });
                }).catch(err => {
                    console.error("Failed to inject script: ", err);
                    displayError('Cannot scan this page due to security restrictions.');
                });
            } else {
                renderData(response);
            }
        });
    });
});

function displayError(msg) {
    document.getElementById('loading-state').classList.remove('active');
    document.getElementById('data-state').classList.add('active');
    document.getElementById('data-state').innerHTML = `<div style="padding: 20px; color: #f87171; text-align: center; font-weight: 500;">${msg}</div>`;
}

function renderData(data) {
    if (!data) {
        displayError('No data returned.');
        return;
    }

    // Parse Data
    renderWP(data.wp);
    renderSEO(data.seo);
    renderDesignSystem(data.design);
    renderEcommerce(data.ecommerce);
    renderOmnichannel(data.omni);
    renderAssets(data.assets);
    renderFunnels(data.hiddenFunnels);

    // Setup Export Button Data
    window.currentScanData = data;

    // Swap UI States
    setTimeout(() => {
        document.getElementById('loading-state').classList.remove('active');
        document.getElementById('data-state').classList.add('active');

        // Open the first accordion (Hidden Funnels) by default
        const firstAcc = document.querySelector('.accordion-header');
        if (firstAcc) {
            firstAcc.click();
        }
    }, 600); // Artificial slight delay to display loading state
}

// Setup Export Event Listener once DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        // Initialize export count span
        const currentMonth = new Date().getMonth();
        chrome.storage.local.get(['exportCount', 'exportMonth'], (res) => {
            let eCount = res.exportCount || 0;
            if (res.exportMonth !== currentMonth) eCount = 0;
            const span = document.getElementById('export-count');
            if (span) span.innerText = eCount;
            if (eCount >= 3) {
                exportBtn.disabled = true;
                exportBtn.innerText = "🔒 Upgrade to Premium for Unlimited Exports";
            }
        });

        exportBtn.addEventListener('click', () => {
            if (window.currentScanData) exportVault(window.currentScanData);
        });
    }
});

function renderWP(wp) {
    const container = document.getElementById('wp-data');
    let html = '';

    html += `
        <div class="data-item">
            <span class="data-label">Status</span>
            <div class="data-value" style="color: ${wp.isWordPress ? 'var(--success)' : 'var(--text-muted)'}; font-weight: 600;">
                ${wp.isWordPress ? '✔️ WordPress Detected' : '❌ Not a WordPress site'}
            </div>
        </div>
    `;

    if (wp.themes && wp.themes.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Active Theme(s)</span>
                <div class="data-value">
                    ${wp.themes.map(t => `<span class="badge">${t}</span>`).join('')}
                </div>
            </div>
        `;
    }

    if (wp.plugins && wp.plugins.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Detected Plugins</span>
                <div class="data-value">
                    ${wp.plugins.map(p => `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">${p}</span>`).join('')}
                </div>
            </div>
        `;
    }

    if (wp.isWordPress && wp.themes.length === 0 && wp.plugins.length === 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Components</span>
                <div class="data-value" style="color: var(--text-muted);">Themes/Plugins are obfuscated or headless.</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderSEO(seo) {
    const container = document.getElementById('seo-data');
    let html = '';

    html += `
        <div class="data-item">
            <span class="data-label">Page Title (${seo.title.length} chars)</span>
            <div class="data-value">${seo.title || 'N/A'}</div>
        </div>
        <div class="data-item">
            <span class="data-label">Meta Description (${seo.metaDesc.length} chars)</span>
            <div class="data-value" style="font-size: 0.8rem; color: var(--text-muted);">${seo.metaDesc || 'N/A'}</div>
        </div>
        <div class="data-item">
            <span class="data-label">Canonical URL</span>
            <div class="data-value" style="font-size: 0.8rem; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${seo.canonicalUrl}">${seo.canonicalUrl || 'N/A'}</div>
        </div>
    `;

    html += `
        <div class="data-item">
            <span class="data-label">Headings</span>
            <div class="data-value">
                <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">H1: ${seo.h1Tags.length}</span>
                <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">H2: ${seo.h2Tags.length}</span>
            </div>
        </div>
    `;

    if (seo.topKeywords && seo.topKeywords.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Top 5 Keyword Density</span>
                <div class="tag-cloud">
                    ${seo.topKeywords.map(k => `
                        <div class="tag">
                            ${k.word} <span class="count">${k.count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderDesignSystem(design) {
    const container = document.getElementById('design-data');
    if (!container) return;

    let html = '';

    // Typography
    if (design && design.typography && design.typography.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Typography (Active Fonts)</span>
                <div class="data-value">
                    ${design.typography.map(f => `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd;">${f}</span>`).join('')}
                </div>
            </div>
        `;
    }

    // Color Palette
    if (design && design.colors && design.colors.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Extracted Color Palette</span>
                <div class="color-swatch-container">
                    ${design.colors.map(hex => `
                        <div class="color-item">
                            <div class="color-circle" style="background-color: ${hex};" title="${hex}"></div>
                            <span class="color-hex">${hex}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="data-item">
                <span class="data-label">Extracted Color Palette</span>
                <div class="data-value" style="color: var(--text-muted);">No distinct brand colors found.</div>
            </div>
        `;
    }

    // Assets
    if (design && design.assets && design.assets.length > 0) {
        // Show up to 3 thumbnails
        const previewAssets = design.assets.slice(0, 3);
        html += `
            <div class="data-item">
                <span class="data-label">Visual Assets (${design.totalAssetsFound} total images found)</span>
                <div class="asset-gallery">
                    ${previewAssets.map(src => `<img src="${src}" class="asset-thumbnail" alt="Asset Preview" title="${src}" />`).join('')}
                </div>
            </div>
        `;
    }

    if (html === '') {
        html = '<div class="data-item"><span class="data-label">Design System</span><div class="data-value" style="color: var(--text-muted);">Could not extract design properties.</div></div>';
    }

    container.innerHTML = html;
}

function renderEcommerce(ecommerce) {
    const container = document.getElementById('ecommerce-data');
    let html = '';

    if (ecommerce.platforms && ecommerce.platforms.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Detected Platforms</span>
                <div class="data-value">
                    ${ecommerce.platforms.map(p => `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">${p}</span>`).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="data-item">
                <span class="data-label">Platforms</span>
                <div class="data-value" style="color: var(--text-muted);">Not Detected</div>
            </div>
        `;
    }

    if (ecommerce.products && ecommerce.products.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Product Schema (ld+json)</span>
                <div class="data-value">
                    ${ecommerce.products.map(p => `
                        <div style="margin-bottom: 8px; border-left: 2px solid var(--border); padding-left: 8px;">
                            <div style="font-weight: 500; font-size: 0.85rem;">${p.name}</div>
                            <div style="color: var(--success); font-family: monospace;">${p.price} ${p.currency}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="data-item">
                <span class="data-label">Product Schema (ld+json)</span>
                <div class="data-value" style="color: var(--text-muted);">Not Detected</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderOmnichannel(omni) {
    const container = document.getElementById('omnichannel-data');
    let html = '';
    let foundAny = false;

    const renderPixels = (label, ids, color, bgColor) => {
        if (!ids || ids.length === 0) return '';
        foundAny = true;
        return `
            <div class="data-item">
                <span class="data-label">${label}</span>
                <div class="data-value">
                    ${ids.map(id => `<span class="badge" style="background: ${bgColor}; color: ${color};">ID: <span style="font-family: monospace;">${id}</span></span>`).join('')}
                </div>
            </div>
        `;
    };

    html += renderPixels('Facebook Pixels', omni.fb, '#a5b4fc', 'rgba(99, 102, 241, 0.2)');
    html += renderPixels('Google Tag Manager', omni.gtm, '#fcd34d', 'rgba(245, 158, 11, 0.2)');
    html += renderPixels('GA4 Properties', omni.ga4, '#fcd34d', 'rgba(245, 158, 11, 0.2)');
    html += renderPixels('TikTok Pixels', omni.tiktok, '#fca5a5', 'rgba(239, 68, 68, 0.2)');
    html += renderPixels('LinkedIn Insight Tags', omni.linkedin, '#93c5fd', 'rgba(59, 130, 246, 0.2)');

    if (!foundAny) {
        html += `
            <div class="data-item">
                <span class="data-label">Status</span>
                <div class="data-value" style="color: var(--text-muted);">No omnichannel pixels detected.</div>
            </div>
        `;
    }

    html += `
        <div class="data-item" style="margin-top: 16px;">
            <span class="data-label">Ads Library Search</span>
            <a href="${omni.adsLibraryUrl}" target="_blank" class="btn">View Parent Domain Ads</a>
            <div style="font-size:0.7rem; color: var(--text-muted); margin-top: 8px; text-align: center;">Target: ${omni.hostname}</div>
        </div>
    `;

    container.innerHTML = html;
}

function renderAssets(assets) {
    const container = document.getElementById('assets-data');
    let html = '';

    if (assets.iframes && assets.iframes.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Interactive Embeds (Iframes)</span>
                <div class="data-value">
                    <ul style="margin:0; padding-left: 16px; color: var(--text-muted);">
                        ${assets.iframes.map(src => `<li style="margin-bottom: 4px; word-break: break-all; font-size: 0.8rem;">${src}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="data-item">
                <span class="data-label">Interactive Embeds</span>
                <div class="data-value" style="color: var(--text-muted);">Not Detected</div>
            </div>
        `;
    }

    if (assets.emailProviders && assets.emailProviders.length > 0) {
        html += `
            <div class="data-item">
                <span class="data-label">Marketing Automation & Email</span>
                <div class="data-value">
                    ${assets.emailProviders.map(p => `<span class="badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6;">${p}</span>`).join('')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="data-item">
                <span class="data-label">Marketing Automation & Email</span>
                <div class="data-value" style="color: var(--text-muted);">Not Detected</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderFunnels(urls) {
    const container = document.getElementById('funnel-data');
    let html = '';

    chrome.storage.local.get(['upsellChecks'], (res) => {
        let count = res.upsellChecks || 0;
        count++; // Increment usage
        chrome.storage.local.set({ upsellChecks: count });

        const isLocked = count > 3;

        if (urls && urls.length > 0) {
            html += `
                <div class="${isLocked ? 'blur-overlay' : ''}">
                    <div class="data-item">
                        <span class="data-label">Exposed Backend Pages</span>
                        <div class="data-value">
                            <ul style="margin:0; padding-left: 16px; color: var(--accent);">
                                ${urls.map(u => `<li style="margin-bottom: 4px; word-break: break-all; font-size: 0.8rem;">
                                    <a href="${u}" target="_blank" style="color: inherit; text-decoration: none;">${u}</a>
                                </li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            if (isLocked) {
                html += `
                    <div class="premium-locked">
                        <div class="lock-icon">🔒</div>
                        <div class="lock-text">🚨 <span class="lock-highlight">${urls.length}</span> Hidden Pages Found.<br>Upgrade to Premium to unlock backend funnel mapping.</div>
                        <a href="#" class="btn" style="margin-top: 12px; font-size: 0.8rem; padding: 6px 12px;">Upgrade Now</a>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="data-item">
                    <span class="data-label">Backend Pages</span>
                    <div class="data-value" style="color: var(--text-muted);">No obvious hidden funnel URLs found in sitemaps/robots.txt.</div>
                </div>
            `;
        }

        container.innerHTML = html;
    });
}

function exportVault(data) {
    const currentMonth = new Date().getMonth();
    chrome.storage.local.get(['exportCount', 'exportMonth'], (res) => {
        let count = res.exportCount || 0;
        let month = res.exportMonth;

        if (month !== currentMonth) {
            count = 0; // Reset for new month
            chrome.storage.local.set({ exportMonth: currentMonth });
        }

        if (count >= 3) {
            return; // Already hit limit, UI should be locked
        }

        count++;
        chrome.storage.local.set({ exportCount: count });

        // Update UI
        const span = document.getElementById('export-count');
        const btn = document.getElementById('export-btn');
        if (span) span.innerText = count;
        if (count >= 3 && btn) {
            btn.disabled = true;
            btn.innerText = "🔒 Upgrade to Premium for Unlimited Exports";
        }

        // Capture Tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            const dateStr = new Date().toLocaleString();
            let domain = 'unknown-domain';
            let screenshotTag = '';

            if (dataUrl) {
                screenshotTag = `<img src="${dataUrl}" alt="Funnel Swipe Screenshot" class="screenshot">`;
            }

            if (window.currentScanData && window.currentScanData.omni && window.currentScanData.omni.hostname) {
                domain = window.currentScanData.omni.hostname;
            } else if (window.currentScanData && window.currentScanData.seo && window.currentScanData.seo.canonicalUrl) {
                try {
                    domain = new URL(window.currentScanData.seo.canonicalUrl).hostname;
                } catch (e) { }
            }

            // Generate clean HTML
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Funnel Swipe: ${domain}</title>
    <style>
        :root {
            --bg: #0f172a;
            --surface: #1e293b;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #3b82f6;
            --border: #334155;
            --success: #10b981;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }
        .header h1 {
            font-size: 2.5rem;
            margin: 0 0 10px 0;
            background: linear-gradient(to right, #60a5fa, #3b82f6);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .header p {
            color: var(--text-muted);
            margin: 0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
            margin-bottom: 40px;
        }
        .card {
            background-color: var(--surface);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--border);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .card h2 {
            font-size: 1.25rem;
            margin-top: 0;
            margin-bottom: 16px;
            color: var(--accent);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 6px;
            background-color: rgba(59, 130, 246, 0.15);
            color: #93c5fd;
            font-size: 0.85rem;
            font-weight: 600;
            margin: 4px;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .screenshot-container {
            background-color: var(--surface);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--border);
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .screenshot {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            border: 1px solid var(--border);
        }
        ul {
            padding-left: 20px;
            margin: 0;
            color: var(--text-muted);
        }
        li {
            margin-bottom: 8px;
        }
        .empty {
            color: var(--text-muted);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Funnel Swipe Vault</h1>
            <p>Target Domain: <strong>${domain}</strong> | Captured: ${dateStr}</p>
        </div>
        
        <div class="grid">
            <!-- Platform Stack -->
            <div class="card">
                <h2>🏗️ Architecture & Platform</h2>
                ${data.wp && data.wp.isWordPress ? '<span class="badge" style="color:#10b981; border-color:#10b981;">WordPress Detected</span><br><br>' : ''}
                ${data.ecommerce && data.ecommerce.platforms && data.ecommerce.platforms.length > 0
                    ? data.ecommerce.platforms.map(p => `<span class="badge">${p}</span>`).join('')
                    : '<div class="empty">No standard e-commerce platforms detected.</div>'}
            </div>

            <!-- SEO & Keywords -->
            <div class="card">
                <h2>🔍 SEO & Keyword Density</h2>
                <div style="margin-bottom:12px;"><strong>Title:</strong> ${data.seo ? data.seo.title : 'N/A'}</div>
                <div><strong>Top Keywords:</strong></div>
                ${data.seo && data.seo.topKeywords && data.seo.topKeywords.length > 0
                    ? data.seo.topKeywords.map(k => `<span class="badge">${k.word} (${k.count})</span>`).join('')
                    : '<div class="empty">No keyword data extracted.</div>'}
            </div>

            <!-- Brand & Design System -->
            <div class="card">
                <h2>🎨 Brand & Design System</h2>
                <div style="margin-bottom:12px;"><strong>Typography:</strong><br>
                ${data.design && data.design.typography && data.design.typography.length > 0
                    ? data.design.typography.map(f => `<span class="badge" style="color:#c4b5fd; border-color:#8b5cf6;">${f}</span>`).join('')
                    : '<div class="empty">No typography extracted.</div>'}
                </div>
                
                <div style="margin-bottom:12px;"><strong>Color Palette:</strong><br>
                ${data.design && data.design.colors && data.design.colors.length > 0
                    ? '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">' + data.design.colors.map(hex => `
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="width:30px; height:30px; border-radius:50%; background-color:${hex}; border:1px solid var(--border);"></div>
                            <span style="font-family:monospace; font-size:0.75rem; color:var(--text-muted); margin-top:4px;">${hex}</span>
                        </div>
                    `).join('') + '</div>'
                    : '<div class="empty">No unique brand colors extracted.</div>'}
                </div>

                <div><strong>Visuals Extracted:</strong> ${data.design ? data.design.totalAssetsFound : 0} image assets found.</div>
            </div>

            <!-- Omnichannel Pixels -->
            <div class="card">
                <h2>📢 Active Pixels</h2>
                ${data.omni && (data.omni.fb.length > 0 || data.omni.gtm.length > 0 || data.omni.ga4.length > 0 || data.omni.tiktok.length > 0)
                    ? `
                        ${data.omni.fb.map(id => `<span class="badge" style="color:#a5b4fc; border-color:#a5b4fc;">FB: ${id}</span>`).join('')}
                        ${data.omni.gtm.map(id => `<span class="badge" style="color:#fcd34d; border-color:#fcd34d;">GTM: ${id}</span>`).join('')}
                        ${data.omni.ga4.map(id => `<span class="badge" style="color:#fcd34d; border-color:#fcd34d;">GA4: ${id}</span>`).join('')}
                        ${data.omni.tiktok.map(id => `<span class="badge" style="color:#fca5a5; border-color:#fca5a5;">TT: ${id}</span>`).join('')}
                    `
                    : '<div class="empty">No major tracking pixels detected.</div>'}
            </div>

            <!-- Lead Magnets & Assets -->
            <div class="card">
                <h2>🧲 Lead Magnets & Forms</h2>
                ${data.assets && data.assets.emailProviders && data.assets.emailProviders.length > 0
                    ? data.assets.emailProviders.map(p => `<span class="badge" style="color:#f472b6; border-color:#f472b6;">${p}</span>`).join('')
                    : '<div class="empty">No integrated email providers detected.</div>'}
            </div>
            
            <!-- Products -->
            <div class="card">
                <h2>🛍️ Schema Products</h2>
                ${data.ecommerce && data.ecommerce.products && data.ecommerce.products.length > 0
                    ? '<ul>' + data.ecommerce.products.map(p => `<li><strong>${p.name}:</strong> <span style="color:var(--success);">${p.price} ${p.currency}</span></li>`).join('') + '</ul>'
                    : '<div class="empty">No ld+json product schema found.</div>'}
            </div>
            
            <!-- Hidden Funnels -->
            <div class="card">
                <h2>🕵️ Discovered Funnel Steps</h2>
                ${data.hiddenFunnels && data.hiddenFunnels.length > 0
                    ? '<ul>' + data.hiddenFunnels.map(u => `<li style="word-break: break-all;">${u}</li>`).join('') + '</ul>'
                    : '<div class="empty">No hidden funnel endpoints discovered.</div>'}
            </div>
        </div>

        <div class="screenshot-container">
            <h2 style="color: var(--accent); margin-top: 0; margin-bottom: 20px; text-align: left;">📸 Above-The-Fold Capture</h2>
            ${screenshotTag || '<div class="empty">Screenshot capture failed or unavailable.</div>'}
        </div>
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const filename = `funnel-swipe-${domain}-${new Date().getTime()}.html`;

            // Final file saving inside try block
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            }, () => {
                URL.revokeObjectURL(url);
            });
        });
    });
}

// ==== FULL PAGE CAPTURE LOGIC ====

document.addEventListener('DOMContentLoaded', () => {
    // Attach event listener for Full Page Capture
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) captureBtn.addEventListener('click', captureFullPage);
});

async function captureFullPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return;

        // Open the dedicated capture page and pass the target tab ID
        chrome.tabs.create({ url: `capture.html?targetId=${tab.id}` });

        // Cleanly close the popup so it doesn't freeze or consume memory
        window.close();
    });
}
