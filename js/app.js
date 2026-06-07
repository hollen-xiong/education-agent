/**
 * app.js — 应用入口，初始化所有模块
 * 依赖：所有其他模块
 * 挂载：window.App.app
 */
(function () {
    "use strict";
    window.App = window.App || {};

    window.App.init = function () {
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
