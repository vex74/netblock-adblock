/**
 * 净网 AdBlock · Background Service Worker
 */

importScripts("../lib/constants.js", "../lib/storage.js", "../rules/builtin.js");

async function syncRules() {
  const settings = await NetBlockStorage.get();
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = oldRules.map((r) => r.id);
  let newRules = [];
  if (settings.enabled) {
    const blockRules = NetBlockBuiltin.buildDNRRules(
      settings.intensity,
      settings.customBlockRules
    );
    const wl = (settings.whitelist || [])
      .map((d) => d.toLowerCase().trim()).filter(Boolean);
    const allowRules = wl.map((domain, i) => ({
      id: 900000 + i,
      priority: 1000,
      action: { type: "allow" },
      condition: { initiatorDomains: [domain] }
    }));
    newRules = [...blockRules, ...allowRules];
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: newRules
  });
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await updateBadge(tab.id, settings);
  } catch (_) {}
}

async function updateBadge(tabId, settings) {
  if (!tabId || tabId < 0) return;
  let text = "", color = "#0d9488";
  try {
    if (!settings.enabled) { text = "off"; color = "#9ca3af"; }
    else {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) {
        const host = safeHost(tab.url);
        if (host && settings.whitelist.some((d) => host === d || host.endsWith("." + d))) {
          text = "白"; color = "#d97706";
        }
      }
    }
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ tabId, text });
  } catch (_) {}
}

function safeHost(url) { try { return new URL(url).hostname; } catch (_) { return null; } }

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.error !== "net::ERR_BLOCKED_BY_CLIENT") return;
    if (details.type === "main_frame") return;
    let domain = null;
    try { domain = new URL(details.url).hostname; } catch (_) { return; }
    if (!domain) return;
    const siteDomain = details.initiator ? safeHost(details.initiator) : domain;
    NetBlockStorage.bumpStat(siteDomain || domain, { requests: 1 });
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || !msg.type) return sendResponse({ ok: false, error: "bad message" });
      switch (msg.type) {
        case "GET_STATE": {
          const settings = await NetBlockStorage.get();
          let tabInfo = null;
          if (sender.tab && sender.tab.url) {
            const host = safeHost(sender.tab.url);
            tabInfo = { host, whitelisted: settings.whitelist.some((d) => host === d || host.endsWith("." + d)) };
          }
          sendResponse({ ok: true, settings, tabInfo });
          break;
        }
        case "UPDATE_SETTINGS": {
          const next = await NetBlockStorage.set(msg.patch || {});
          await syncRules();
          sendResponse({ ok: true, settings: next });
          break;
        }
        case "RESET_SETTINGS": {
          const next = await NetBlockStorage.reset();
          await syncRules();
          sendResponse({ ok: true, settings: next });
          break;
        }
        case "REPORT_ELEMENTS_HIDDEN": {
          const count = Number(msg.count) || 0;
          if (count > 0 && sender.tab && sender.tab.url) {
            const host = safeHost(sender.tab.url);
            await NetBlockStorage.bumpStat(host, { elements: count });
          }
          sendResponse({ ok: true });
          break;
        }
        case "ADD_CUSTOM_HIDE_SELECTOR": {
          const sel = (msg.selector || "").trim();
          if (!sel) { sendResponse({ ok: false }); break; }
          const settings = await NetBlockStorage.get();
          if (settings.customHideSelectors.includes(sel)) { sendResponse({ ok: true, existed: true }); break; }
          const next = await NetBlockStorage.set({ customHideSelectors: [...settings.customHideSelectors, sel] });
          sendResponse({ ok: true, settings: next });
          break;
        }
        case "TOGGLE_SITE": {
          const { host, whitelisted, tabId } = msg;
          const settings = await NetBlockStorage.get();
          let wl = [...settings.whitelist];
          if (whitelisted) wl = wl.filter((d) => d !== host);
          else if (!wl.includes(host)) wl.push(host);
          const next = await NetBlockStorage.set({ whitelist: wl });
          await syncRules();
          if (tabId) { try { await chrome.tabs.reload(Number(tabId)); } catch (_) {} }
          sendResponse({ ok: true, settings: next });
          break;
        }
        default: sendResponse({ ok: false, error: "unknown type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true;
});

chrome.storage.onChanged.addListener(() => { syncRules(); });
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    const settings = await NetBlockStorage.get();
    updateBadge(tabId, settings);
  }
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const settings = await NetBlockStorage.get();
  updateBadge(tabId, settings);
});
syncRules();
