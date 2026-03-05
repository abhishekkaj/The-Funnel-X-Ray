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
            const exportPayload = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    url: window.currentScanData ? window.currentScanData.seo.canonicalUrl || 'unknown' : 'unknown'
                },
                data: data,
                screenshot: dataUrl || null
            };

            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const filename = `FunnelXRay_Export_${new Date().getTime()}.json`;

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
