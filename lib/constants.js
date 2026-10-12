/**
 * 净网 AdBlock · 全局常量与默认配置
 */
const NetBlock = (() => {
  const INTENSITY = { AGGRESSIVE: "aggressive", BALANCED: "balanced", LENIENT: "lenient" };
  const INTENSITY_LABEL = { aggressive: "激进", balanced: "均衡", lenient: "宽松" };
  const THEME = { LIGHT: "light", DARK: "dark" };
  const ACCENT_COLORS = [
    { id: "teal", label: "青碧", value: "#0d9488" },
    { id: "blue", label: "靛蓝", value: "#2563eb" },
    { id: "violet", label: "紫晶", value: "#7c3aed" },
    { id: "rose", label: "蔷薇", value: "#e11d48" },
    { id: "amber", label: "琥珀", value: "#d97706" },
    { id: "green", label: "松绿", value: "#16a34a" }
  ];
  const DEFAULT_SETTINGS = {
    enabled: true, intensity: INTENSITY.BALANCED, locale: "zh-CN",
    theme: THEME.LIGHT, accent: "teal",
    whitelist: [], customBlockRules: [], customHideSelectors: [],
    stats: { requests: 0, elements: 0, byDomain: {} }
  };
  const STORAGE_KEY = "netblock.settings.v1";
  return { INTENSITY, INTENSITY_LABEL, THEME, ACCENT_COLORS, DEFAULT_SETTINGS, STORAGE_KEY };
})();
if (typeof self !== "undefined") self.NetBlock = NetBlock;
if (typeof window !== "undefined") window.NetBlock = NetBlock;
