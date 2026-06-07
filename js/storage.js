/**
 * storage.js — localStorage 读写层，统一错误处理
 * 依赖：config.js
 * 挂载：window.App.storage
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;

    var MODULE = {};

    // ========== 通用工具 ==========

    /** 安全的 localStorage.setItem，带 QuotaExceededError 保护 */
    MODULE.safeSetItem = function (key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            if (e.name === "QuotaExceededError" || e.code === 22) {
                alert("存储空间已满，请清理浏览器数据后重试。");
            } else {
                throw e;
            }
        }
    };

    /** 安全读取 JSON，失败返回 fallback */
    function safeGetJSON(key, fallback) {
        try {
            var raw = JSON.parse(localStorage.getItem(key) || "null");
            return raw !== null ? raw : fallback;
        } catch (e) {
            return fallback;
        }
    }

    // ========== 优点 ==========
    MODULE.getHighlights = function () {
        return safeGetJSON(C.STORAGE_HIGHLIGHTS, []);
    };
    MODULE.saveHighlights = function (list) {
        MODULE.safeSetItem(C.STORAGE_HIGHLIGHTS, JSON.stringify(list));
    };

    // ========== 缺点 ==========
    MODULE.getWeakPoints = function () {
        return safeGetJSON(C.STORAGE_WEAKPOINTS, []);
    };
    MODULE.saveWeakPoints = function (list) {
        MODULE.safeSetItem(C.STORAGE_WEAKPOINTS, JSON.stringify(list));
    };

    // ========== 改进建议 ==========
    MODULE.getSuggestions = function () {
        return safeGetJSON(C.STORAGE_SUGGESTIONS, []);
    };
    MODULE.saveSuggestions = function (list) {
        MODULE.safeSetItem(C.STORAGE_SUGGESTIONS, JSON.stringify(list));
    };

    // ========== 寄语 ==========
    MODULE.getEncouragements = function () {
        return safeGetJSON(C.STORAGE_ENCOURAGEMENTS, []);
    };
    MODULE.saveEncouragements = function (list) {
        MODULE.safeSetItem(C.STORAGE_ENCOURAGEMENTS, JSON.stringify(list));
    };

    // ========== API Key ==========
    MODULE.getApiKey = function () {
        return localStorage.getItem(C.STORAGE_API_KEY) || "";
    };
    MODULE.saveApiKey = function (key) {
        MODULE.safeSetItem(C.STORAGE_API_KEY, key);
    };

    // ========== 问候语开关 ==========
    MODULE.getGreetingSwitch = function () {
        var saved = localStorage.getItem(C.STORAGE_GREETING_SWITCH);
        return saved !== null ? saved === "true" : true; // 默认开启
    };
    MODULE.saveGreetingSwitch = function (enabled) {
        MODULE.safeSetItem(C.STORAGE_GREETING_SWITCH, enabled ? "true" : "false");
    };

    // ========== 学生记忆 ==========
    MODULE.getStudents = function () {
        return safeGetJSON(C.STORAGE_STUDENTS, []);
    };
    MODULE.saveStudents = function (list) {
        MODULE.safeSetItem(C.STORAGE_STUDENTS, JSON.stringify(list));
    };

    // ========== 反馈历史 ==========
    MODULE.getFeedbackHistory = function () {
        var history = safeGetJSON(C.STORAGE_FEEDBACK_HISTORY, []);
        return Array.isArray(history)
            ? history.filter(function (item) { return item && item.text; }).slice(0, C.HISTORY_LIMIT)
            : [];
    };
    MODULE.saveFeedbackHistoryEntry = function (item) {
        var history = MODULE.getFeedbackHistory();
        history.unshift(item);
        MODULE.safeSetItem(C.STORAGE_FEEDBACK_HISTORY, JSON.stringify(history.slice(0, C.HISTORY_LIMIT)));
    };
    MODULE.clearFeedbackHistory = function () {
        localStorage.removeItem(C.STORAGE_FEEDBACK_HISTORY);
    };

    window.App.storage = MODULE;
})();
