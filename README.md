# 净网 AdBlock

轻量 MV3 广告拦截浏览器扩展。

## 功能

- 三档拦截强度（宽松 / 均衡 / 激进）
- 199 条内置 URL 拦截规则 + 115 个元素隐藏选择器
- 点选屏蔽（Element Picker）
- 自定义 URL 规则与 CSS 选择器
- 站点白名单（临时放行）
- 拦截统计面板
- 中英文切换、深浅主题、6 种强调色
- 纯本地运行，不收集任何用户数据

## 安装

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录

## 技术栈

- Manifest V3
- declarativeNetRequest（网络层拦截）
- MutationObserver（动态元素隐藏）
- 纯原生 JS，无框架依赖
