/**
 * 净网 AdBlock · Content Script
 */
(function () {
  const STORAGE_KEY = "netblock.settings.v1";
  if (window.__netblockInjected) return;
  window.__netblockInjected = true;

  let hiddenCount = 0, styleEl = null, observer = null, currentSettings = null;

  function getHideSelectors(settings) {
    if (!settings.enabled) return [];
    const host = location.hostname;
    if (settings.whitelist && settings.whitelist.some((d) => host === d || host.endsWith("." + d))) return [];
    let builtin = [];
    try {
      const tier = settings.intensity || "balanced";
      builtin = BUILTIN_SELECTORS[tier] || BUILTIN_SELECTORS.balanced;
    } catch (_) {}
    const custom = settings.customHideSelectors || [];
    return [...builtin, ...custom];
  }

  const BUILTIN_SELECTORS = (() => {
    const lenient = ['ins.adsbygoogle','ins.adsbygoogle-noablate','div[id^="google_ads_iframe"]','iframe[src*="doubleclick.net"]','iframe[src*="googlesyndication.com"]','[id^="div-gpt-ad"]','[data-ad-slot]','[data-ad-client]'];
    const balanced = ['div[id^="google_ads_iframe"]','ins.adsbygoogle','ins.adsbygoogle-noablate','iframe[src*="doubleclick.net"]','iframe[src*="googlesyndication.com"]','iframe[src*="googleadservices.com"]','[id^="ad-slot-"]','[id^="ad_banner"]','[id^="div-gpt-ad"]','[class*="ad-banner"]','[class*="advertisement"]','.advert-banner','[class*="sponsored-content"]','[data-ad]','[data-ad-client]','[data-ad-slot]','[id*="ad-container"]','aside[class*="sponsored"]','.adsbox','[class*="sidebar-ad"]','[data-ads]','img[src*="banner"]','img[src*="/ads/"]','img[src*="advertising"]','[class*="banner-ad"]','[class*="in-text-ad"]','[class*="inline-ad"]','[class*="floating-ad"]','[class*="sticky-ad"]','[class*="video-overlay"]','[class*="video-ad"]','[class*="overlay-ad"]','[class*="deceptive"]','[class*="fake-ad"]','[class*="ad-box"]','[class*="ad-wrapper"]','[class*="ad-container"]','[class*="ad-placement"]','[class*="ad-unit"]','[class*="ad-zone"]','.anti-adblock-test','.bait-content','.deceptive-ad','.dynamic-ad','.floating-ad','.ad-label','[class*="popup-ad"]','[class*="popunder"]','[class*="modal-ad"]','[class*="interstitial-ad"]','[class*="fullscreen-ad"]','[class*="preroll-ad"]','[class*="midroll-ad"]','[class*="rail-ad"]','[class*="side-ad"]','[class*="footer-ad"]','[class*="leaderboard-ad"]','[class*="skyscraper-ad"]','[class*="rectangle-ad"]','[class*="adslot"]','[class*="ad-holder"]','[class*="adframe"]','[class*="ad-frame"]','[class*="ad-placeholder"]','[class*="mobile-ad"]','[class*="advertorial"]','[class*="sponsor-"]','[class*="adblock-message"]','[class*="ad-badge"]','[class*="ad-tag"]'];
    const aggressive = [...balanced, '[class^="ad-"]','[class*=" ad-"]','[id^="ad-"]','[id*=" ad-"]','[class^="ad_"]','[id^="ad_"]'];
    return { lenient, balanced, aggressive };
  })();

  function injectStyle(selectors) {
    if (styleEl) styleEl.remove();
    if (!selectors.length) return;
    styleEl = document.createElement("style");
    styleEl.id = "__netblock_style";
    styleEl.textContent = selectors.map(s => `${s}{display:none!important;visibility:hidden!important;}`).join("\n");
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function scanAndCount() {
    if (!currentSettings) return;
    const selectors = getHideSelectors(currentSettings);
    if (!selectors.length) return;
    let added = 0;
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((n) => {
          if (!n.__netblockHidden) { n.__netblockHidden = true; added++; }
        });
      } catch (_) {}
    }
    if (added > 0) {
      try { chrome.runtime.sendMessage({ type: "REPORT_ELEMENTS_HIDDEN", count: added }); } catch (_) {}
    }
  }

  function observe() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (observer._timer) return;
      observer._timer = setTimeout(() => { observer._timer = null; scanAndCount(); }, 300);
    });
    observer.observe(document.documentElement || document, { childList: true, subtree: true, attributes: false });
  }

  // Element Picker
  let pickerActive = false, pickerHighlight = null, pickerBar = null;
  function cssEscape(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  function generateSelector(el) {
    if (el.id) { const sel = "#" + cssEscape(el.id); try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (_) {} }
    const path = []; let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) part += "." + cssEscape(node.classList[0]);
      const parent = node.parentElement;
      if (parent) part += ":nth-child(" + (Array.prototype.indexOf.call(parent.children, node) + 1) + ")";
      path.unshift(part); node = parent;
    }
    return path.join(" > ");
  }
  function ensurePickerUI() {
    if (pickerHighlight) return;
    pickerHighlight = document.createElement("div");
    pickerHighlight.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;background:rgba(255,59,48,0.25);outline:2px solid #ff3b30;display:none;";
    pickerBar = document.createElement("div");
    pickerBar.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1c1c1e;color:#fff;padding:8px 16px;border-radius:8px;font:13px/1.5 system-ui;";
    pickerBar.textContent = "点击要屏蔽的元素 · Esc 取消";
    document.documentElement.appendChild(pickerHighlight);
    document.documentElement.appendChild(pickerBar);
  }
  function removePickerUI() { if (pickerHighlight) { pickerHighlight.remove(); pickerHighlight = null; } if (pickerBar) { pickerBar.remove(); pickerBar = null; } }
  function onPickerMove(e) {
    const el = e.target; if (!el || el === pickerHighlight || el === pickerBar) return;
    const r = el.getBoundingClientRect();
    pickerHighlight.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;position:fixed;z-index:2147483647;pointer-events:none;background:rgba(255,59,48,0.25);outline:2px solid #ff3b30;display:block;`;
  }
  function onPickerClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.target; if (!el || el === pickerHighlight || el === pickerBar || el === document.documentElement || el === document.body) return;
    const sel = generateSelector(el);
    try { chrome.runtime.sendMessage({ type: "ADD_CUSTOM_HIDE_SELECTOR", selector: sel }); } catch (_) {}
    stopPicker();
  }
  function onPickerKey(e) { if (e.key === "Escape") stopPicker(); }
  function startPicker() {
    if (pickerActive) return; pickerActive = true; ensurePickerUI();
    document.addEventListener("mousemove", onPickerMove, true);
    document.addEventListener("click", onPickerClick, true);
    document.addEventListener("keydown", onPickerKey, true);
    if (document.body) document.body.style.cursor = "crosshair";
  }
  function stopPicker() {
    if (!pickerActive) return; pickerActive = false;
    document.removeEventListener("mousemove", onPickerMove, true);
    document.removeEventListener("click", onPickerClick, true);
    document.removeEventListener("keydown", onPickerKey, true);
    if (document.body) document.body.style.cursor = "";
    removePickerUI();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "START_PICKER") startPicker();
    else if (msg.type === "STOP_PICKER") stopPicker();
  });

  const DEFAULTS = { enabled: true, intensity: "balanced", locale: "zh-CN", whitelist: [], customHideSelectors: [] };
  function mergeDefaults(s) { return { ...DEFAULTS, ...(s || {}) }; }

  async function init() {
    try { const data = await chrome.storage.local.get(STORAGE_KEY); currentSettings = mergeDefaults(data[STORAGE_KEY]); }
    catch (_) { currentSettings = mergeDefaults({}); }
    injectStyle(getHideSelectors(currentSettings));
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { scanAndCount(); observe(); });
    } else { scanAndCount(); observe(); }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      currentSettings = mergeDefaults(changes[STORAGE_KEY].newValue);
      injectStyle(getHideSelectors(currentSettings));
      document.querySelectorAll("*").forEach((n) => { n.__netblockHidden = false; });
      scanAndCount();
    });
  }
  init();
})();
