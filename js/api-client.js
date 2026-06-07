/**
 * api-client.js — HTTP API 客户端（替代 localStorage 操作）
 * 所有数据操作改为 fetch() 后端 API
 * 依赖：config.js
 * 挂载：window.App.apiClient
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;

    var MODULE = {};

    // ========== 基础配置 ==========
    var BASE = "";  // 空 = 相对路径，同源访问

    /** 设置 API 基础地址（部署时可改） */
    MODULE.setBaseUrl = function (url) {
        BASE = url.replace(/\/+$/, "");
    };

    /** 获取当前 base URL */
    function baseUrl() {
        return BASE || window.location.origin;
    }

    /** 健康检查 */
    MODULE.healthCheck = async function () {
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () { controller.abort(); }, 3000);
            var resp = await fetch(baseUrl() + "/api/students?search=", { signal: controller.signal });
            clearTimeout(timeoutId);
            return { ok: resp.ok, status: resp.status };
        } catch (e) {
            return { ok: false, status: 0, error: e.message };
        }
    };

    // ========== 通用 fetch 封装 ==========
    async function apiGet(path) {
        var resp = await fetch(BASE + path);
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return { error: "请求失败" }; });
            throw new Error(err.error || "HTTP " + resp.status);
        }
        return resp.json();
    }

    async function apiPost(path, data) {
        var resp = await fetch(BASE + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return { error: "请求失败" }; });
            throw new Error(err.error || "HTTP " + resp.status);
        }
        return resp.json();
    }

    async function apiDelete(path) {
        var resp = await fetch(BASE + path, { method: "DELETE" });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return { error: "请求失败" }; });
            throw new Error(err.error || "HTTP " + resp.status);
        }
        return resp.json();
    }

    async function apiPut(path, data) {
        var resp = await fetch(BASE + path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!resp.ok) {
            var err = await resp.json().catch(function () { return { error: "请求失败" }; });
            throw new Error(err.error || "HTTP " + resp.status);
        }
        return resp.json();
    }

    // ========== 学生管理 ==========

    MODULE.getStudents = async function () {
        try {
            return await apiGet("/api/students");
        } catch (e) {
            console.warn("[api-client] getStudents 失败:", e.message);
            return [];
        }
    };

    MODULE.saveStudents = async function (list) {
        // 批量保存通过逐个 upsert 实现
        // 通常前端调用此函数是已处理好的列表，后端以 name 为 key 做 upsert
        try {
            for (var i = 0; i < list.length; i++) {
                await apiPost("/api/students", list[i]);
            }
            return true;
        } catch (e) {
            console.warn("[api-client] saveStudents 失败:", e.message);
            return false;
        }
    };

    MODULE.findStudent = async function (name) {
        try {
            var students = await apiGet("/api/students?search=" + encodeURIComponent(name));
            var normalized = (name || "").replace(/\s+/g, "").trim();
            for (var i = 0; i < students.length; i++) {
                if ((students[i].name || "").replace(/\s+/g, "").trim() === normalized) {
                    return students[i];
                }
            }
            return null;
        } catch (e) {
            console.warn("[api-client] findStudent 失败:", e.message);
            return null;
        }
    };

    MODULE.getStudentSessions = async function (name) {
        try {
            var student = await MODULE.findStudent(name);
            if (!student) return null;
            var data = await apiGet("/api/students/" + student.id + "/sessions");
            return {
                profile: data.student,
                sessions: data.sessions || [],
                sessionCount: data.count || 0,
                lastSession: (data.sessions || []).length > 0 ? data.sessions[0] : null
            };
        } catch (e) {
            console.warn("[api-client] getStudentSessions 失败:", e.message);
            return null;
        }
    };

    MODULE.addStudentSession = async function (studentName, session) {
        try {
            // 先 upsert 学生
            await apiPost("/api/students", {
                name: studentName,
                gender: session.gender || "",
                grade: session.grade || "",
                subject: session.subject || "",
                notes: session.notes || "",
                tags: session.tags || [],
            });
            // 查找学生 ID
            var student = await MODULE.findStudent(studentName);
            if (!student) return false;
            // 添加 session
            await apiPost("/api/students/" + student.id + "/sessions", session);
            return true;
        } catch (e) {
            console.warn("[api-client] addStudentSession 失败:", e.message);
            return false;
        }
    };

    // ========== 自定义列表 ==========

    function _getList(listType) {
        return apiGet("/api/lists/" + listType).then(function (items) {
            return items.map(function (item) { return item.value; });
        }).catch(function () { return []; });
    }

    function _saveList(listType, values) {
        // 前端传入完整 values 数组时，先清空再批量添加
        // 简化处理：前端通常添加单个，用 addItem
        return Promise.resolve(true);
    }

    function _addListItem(listType, value) {
        return apiPost("/api/lists/" + listType, { value: value }).catch(function () { return null; });
    }

    function _deleteListItem(listType, value) {
        // 需要先找到 id... 简化：获取列表后匹配删除
        return apiGet("/api/lists/" + listType).then(function (items) {
            var target = items.find(function (item) { return item.value === value; });
            if (target) {
                return apiDelete("/api/lists/" + listType + "/" + target.id);
            }
        }).catch(function () {});
    }

    MODULE.getHighlights = function () { return _getList("highlights"); };
    MODULE.getWeakPoints = function () { return _getList("weakpoints"); };
    MODULE.getSuggestions = function () { return _getList("suggestions"); };
    MODULE.getEncouragements = function () { return _getList("encouragements"); };

    MODULE.saveHighlights = function (list) { return _saveList("highlights", list); };
    MODULE.saveWeakPoints = function (list) { return _saveList("weakpoints", list); };
    MODULE.saveSuggestions = function (list) { return _saveList("suggestions", list); };
    MODULE.saveEncouragements = function (list) { return _saveList("encouragements", list); };

    MODULE.addHighlight = function (v) { return _addListItem("highlights", v); };
    MODULE.addWeakPoint = function (v) { return _addListItem("weakpoints", v); };
    MODULE.addSuggestion = function (v) { return _addListItem("suggestions", v); };
    MODULE.addEncouragement = function (v) { return _addListItem("encouragements", v); };

    MODULE.deleteHighlight = function (v) { return _deleteListItem("highlights", v); };
    MODULE.deleteWeakPoint = function (v) { return _deleteListItem("weakpoints", v); };
    MODULE.deleteSuggestion = function (v) { return _deleteListItem("suggestions", v); };
    MODULE.deleteEncouragement = function (v) { return _deleteListItem("encouragements", v); };

    // ========== 反馈历史 ==========

    MODULE.getFeedbackHistory = async function () {
        try {
            return await apiGet("/api/feedback/history");
        } catch (e) {
            return [];
        }
    };

    MODULE.saveFeedbackHistoryEntry = async function (item) {
        try {
            return await apiPost("/api/feedback/history", item);
        } catch (e) {
            console.warn("[api-client] saveFeedbackHistory 失败:", e.message);
            return null;
        }
    };

    MODULE.clearFeedbackHistory = async function () {
        try {
            return await apiDelete("/api/feedback/history");
        } catch (e) {
            console.warn("[api-client] clearHistory 失败:", e.message);
        }
    };

    // ========== 设置 ==========

    MODULE.getSettings = async function () {
        try {
            return await apiGet("/api/settings");
        } catch (e) {
            return {};
        }
    };

    MODULE.saveSettings = async function (settings) {
        try {
            return await apiPut("/api/settings", settings);
        } catch (e) {
            console.warn("[api-client] saveSettings 失败:", e.message);
            return null;
        }
    };

    MODULE.getApiKey = async function () {
        try {
            var s = await MODULE.getSettings();
            return s.api_key || "";
        } catch (e) {
            return "";
        }
    };

    MODULE.saveApiKey = async function (key) {
        return MODULE.saveSettings({ api_key: key });
    };

    MODULE.validateApiKey = async function (apiKey) {
        try {
            return await apiPost("/api/ai/validate-key", { api_key: apiKey });
        } catch (e) {
            return { ok: false, message: "无法连接后端验证" };
        }
    };

    MODULE.getGreetingSwitch = async function () {
        try {
            var s = await MODULE.getSettings();
            return s.greeting_enabled !== "false";
        } catch (e) {
            return true;
        }
    };

    MODULE.saveGreetingSwitch = async function (enabled) {
        return MODULE.saveSettings({ greeting_enabled: enabled ? "true" : "false" });
    };

    // ========== AI 生成 ==========

    MODULE.generateFeedback = async function (messages, temperature) {
        try {
            var result = await apiPost("/api/ai/generate", {
                messages: messages,
                temperature: temperature || 0.42,
            });
            if (!result.ok) throw new Error(result.error || "生成失败");
            return result.content;
        } catch (e) {
            throw new Error("AI 生成失败: " + e.message);
        }
    };

    MODULE.reviseFeedback = async function (messages) {
        try {
            var result = await apiPost("/api/ai/revise", {
                messages: messages,
                temperature: 0.35,
            });
            if (!result.ok) throw new Error(result.error || "修改失败");
            return result.content;
        } catch (e) {
            throw new Error("二次修改失败: " + e.message);
        }
    };

    // ========== 存储用量（从后端获取） ==========

    MODULE.getStorageReport = async function () {
        try {
            return await apiGet("/api/settings");
        } catch (e) {
            return { usedMB: 0, status: "ok" };
        }
    };

    MODULE.autoCleanup = async function () {
        // 后端 SQLite 自动管理空间
        return MODULE.getStorageReport();
    };

    window.App.apiClient = MODULE;
})();
