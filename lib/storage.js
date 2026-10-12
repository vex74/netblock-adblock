/**
 * 净网 AdBlock · 存储封装
 */
const NetBlockStorage = (() => {
  const KEY = (typeof NetBlock !== "undefined" && NetBlock.STORAGE_KEY) ? NetBlock.STORAGE_KEY : "netblock.settings.v1";
  const DEFAULTS = (typeof NetBlock !== "undefined") ? NetBlock.DEFAULT_SETTINGS : { enabled: true, intensity: "balanced", theme: "light", accent: "teal", whitelist: [], customBlockRules: [], customHideSelectors: [], stats: { requests: 0, elements: 0, byDomain: {} } };
  function deepMerge(base, override) {
    if (Array.isArray(base)) return (override === undefined ? base : [...override]);
    if (typeof base === "object" && base !== null) {
      const out = { ...base };
      for (const k of Object.keys(base)) out[k] = deepMerge(base[k], override ? override[k] : undefined);
      if (override) for (const k of Object.keys(override)) if (!(k in out)) out[k] = override[k];
      return out;
    }
    return override === undefined ? base : override;
  }
  async function get() { const data = await chrome.storage.local.get(KEY); return deepMerge(DEFAULTS, data[KEY]); }
  async function set(patch) { const current = await get(); const next = deepMerge(current, patch); await chrome.storage.local.set({ [KEY]: next }); return next; }
  async function reset() { await chrome.storage.local.set({ [KEY]: DEFAULTS }); return { ...DEFAULTS }; }
  async function bumpStat(domain, { requests = 0, elements = 0 } = {}) {
    if (!domain) return;
    const s = await get();
    s.stats.requests += requests; s.stats.elements += elements;
    if (!s.stats.byDomain[domain]) s.stats.byDomain[domain] = { requests: 0, elements: 0 };
    s.stats.byDomain[domain].requests += requests; s.stats.byDomain[domain].elements += elements;
    await chrome.storage.local.set({ [KEY]: s });
  }
  function onChanged(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[KEY]) return;
      cb(changes[KEY].newValue, changes[KEY].oldValue);
    });
  }
  return { get, set, reset, bumpStat, onChanged, KEY };
})();
if (typeof self !== "undefined") self.NetBlockStorage = NetBlockStorage;
if (typeof window !== "undefined") window.NetBlockStorage = NetBlockStorage;
