/**
 * app.js — 应用入口，初始化所有模块
 * 依赖：所有其他模块
 * 挂载：window.App.app
 */
(function () {
    "use strict";
    window.App = window.App || {};

    window.App.init = async function () {
        // 1. 迁移旧版 API Key 到加密存储
        if (window.App.storage && typeof window.App.storage.migrateApiKeyIfNeeded === "function") {
            await window.App.storage.migrateApiKeyIfNeeded();
        }

        // 2. 检查存储容量
        if (window.App.storage && typeof window.App.storage.getStorageReport === "function") {
            var report = window.App.storage.getStorageReport();
            if (report.status === "full") {
                window.App.storage.autoCleanup();
            }
            if (report.status !== "ok") {
                console.warn("[app] 存储用量: " + report.usedMB.toFixed(1) + "MB (" + report.percent + "%)");
            }
        }

        // 3. 初始化 UI
        if (window.App.ui && typeof window.App.ui.init === "function") {
            window.App.ui.init();
        }
    };

    // 自动启动
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", window.App.init);
    } else {
        window.App.init();
    }
})();
