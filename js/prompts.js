/**
 * prompts.js — Prompt 构建（轻量 wrapper，实际构建在后端 Python）
 * 依赖：config.js
 * 挂载：window.App.prompts
 */
(function () {
    "use strict";
    window.App = window.App || {};

    var MODULE = {};

    // ========== 前端 UI 读取函数（保留，无引号问题） ==========

    MODULE.getExpressionMode = function () {
        var el = document.querySelector('input[name="tempMode"]:checked');
        return el ? el.value : "real";
    };

    MODULE.getToneMode = function () {
        var el = document.querySelector('input[name="toneStyle"]:checked');
        return el ? el.value : "neutral";
    };

    MODULE.getTemperatureByMode = function () {
        return (MODULE.getExpressionMode() === "vivid") ? [0.62, 0.46] : [0.42, 0.32];
    };

    MODULE.getWordCountRange = function () {
        var el = document.getElementById("wordCountSelect");
        var val = parseInt(el ? el.value : "300", 10);
        return ({150:[125,165],200:[175,215],250:[225,265],300:[270,315],350:[315,365],400:[360,420]})[val] || [270,315];
    };

    // ========== 核心：调用后端构建 Prompt 并返回 messages ==========

    /** 主生成——发送 formData 到后端，后端构建 Prompt */
    MODULE.buildMessages = async function (formData) {
        var resp = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function() { return {error: "后端错误"}; });
            throw new Error(err.error || "生成失败");
        }
        return await resp.json();
    };

    /** 快速生成 */
    MODULE.buildQuickMessages = async function (formData) {
        var resp = await fetch("/api/ai/generate-quick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        if (!resp.ok) throw new Error("快速生成失败");
        return await resp.json();
    };

    /** 二次修改 */
    MODULE.buildRevisionMessages = async function (type, currentText, formData) {
        var resp = await fetch("/api/ai/revise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: type, currentText: currentText, formData: formData })
        });
        if (!resp.ok) throw new Error("二次修改失败");
        return await resp.json();
    };

    // ========== 兼容旧接口（前端 api.js 调用这些函数） ==========

    MODULE.buildInitialMessages = async function (formData) {
        // 返回 messages 结构供 generateFeedback 使用
        // 实际上直接走 MODULE.buildMessages 即可
        return formData;  // 后端自己构建 messages
    };

    MODULE.buildQuickFormData = function (baseFormData) {
        var studentTypeEl = document.getElementById("quickStudentType");
        var directionEl = document.getElementById("quickFeedbackDirection");
        var studentType = studentTypeEl ? studentTypeEl.value : "普通学生";
        var direction = directionEl ? directionEl.value : "表扬鼓励";
        var result = {};
        for (var k in baseFormData) { if (baseFormData.hasOwnProperty(k)) result[k] = baseFormData[k]; }
        result.quickStudentType = studentType;
        result.quickDirection = direction;
        return result;
    };

    MODULE.getQuickPreset = function (studentType, direction) {
        var key = (studentType || "普通学生") + "|" + (direction || "表扬鼓励");
        var presets = window.App.config.QUICK_PRESETS || {};
        return presets[key] || presets["普通学生|表扬鼓励"] || {};
    };

    // 场景标签（纯逻辑，无中文引号问题）
    MODULE.inferSceneTags = function (formData) {
        var tags = [];
        var highlights = (formData && formData.selectedHighlights || []).join("、");
        var weak = (formData && formData.selectedWeak || []).join("、");
        var all = highlights + "；" + weak;
        if (/期中|期末|考试|复习/.test(all)) tags.push("考试复习");
        if (/遗忘|忘记/.test(all)) tags.push("知识点遗忘");
        if (/计算|步骤/.test(all)) tags.push("计算步骤");
        if (/自满|飘/.test(all)) tags.push("状态调整");
        return tags.slice(0, 10);
    };

    MODULE.getHistoryPromptBlock = async function () { return ""; };  // 后端处理
    MODULE.getToneInstruction = function () { return ""; };  // 后端处理
    MODULE.getToneExampleBlock = function () { return ""; };  // 后端处理
    MODULE.getExpressionModeInstruction = function () { return ""; };  // 后端处理
    MODULE.getAntiStiffInstruction = function () { return ""; };  // 后端处理
    MODULE.getRealTeacherCorpusInstruction = function () { return ""; };  // 后端处理
    MODULE.getSceneWritingHints = function () { return ""; };  // 后端处理
    MODULE.getStyleVariation = function () { return ""; };  // 后端处理
    MODULE.buildFactWhitelist = function () { return []; };  // 后端处理
    MODULE.buildFactPrompt = function () { return ""; };  // 后端处理
    MODULE.buildRevisionInstruction = function () { return ""; };  // 后端处理

    window.App.prompts = MODULE;
})();
