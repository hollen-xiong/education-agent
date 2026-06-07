/**
 * storage.js — localStorage 读写层，统一错误处理
 * 功能：加密存储、API Key 校验、容量保护、学生数据管理
 * 依赖：config.js
 * 挂载：window.App.storage
 */
(function () {
    "use strict";
    window.App = window.App || {};
    var C = window.App.config;

    var MODULE = {};

    // ========== 通用工具 ==========

    /** 估计 localStorage 当前使用量 (MB) */
    function estimateUsageMB() {
        var total = 0;
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            total += (key ? key.length : 0) + (localStorage.getItem(key) || "").length;
        }
        return total / (1024 * 1024);
    }

    /** 检查 localStorage 容量 */
    function checkQuota(neededBytes) {
        var used = estimateUsageMB();
        if (used >= C.LOCALSTORAGE_QUOTA_MAX) {
            return { ok: false, usedMB: used, message: "存储空间已满（" + used.toFixed(1) + "MB），请清理历史数据后重试。" };
        }
        if (used >= C.LOCALSTORAGE_QUOTA_WARN) {
            return { ok: true, usedMB: used, warning: "存储空间紧张（" + used.toFixed(1) + "MB），建议清理旧数据。" };
        }
        return { ok: true, usedMB: used };
    }

    /** 安全的 localStorage.setItem，带 QuotaExceededError 保护 */
    MODULE.safeSetItem = function (key, value) {
        var quota = checkQuota(String(value || "").length);
        if (!quota.ok) {
            alert(quota.message);
            return false;
        }
        if (quota.warning) {
            console.warn("[storage] " + quota.warning);
        }
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === "QuotaExceededError" || e.code === 22 || e.message.indexOf("quota") >= 0) {
                alert("存储空间已满！请点击"清空历史"释放空间。\n当前用量约 " + estimateUsageMB().toFixed(1) + "MB。");
                return false;
            }
            throw e;
        }
    };

    /** 获取存储用量报告 */
    MODULE.getStorageReport = function () {
        var used = estimateUsageMB();
        return {
            usedMB: used,
            percent: Math.round(used / 5 * 100),
            status: used >= C.LOCALSTORAGE_QUOTA_MAX ? "full" : (used >= C.LOCALSTORAGE_QUOTA_WARN ? "warn" : "ok")
        };
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

    // ========== API Key 加密存储 (AES-GCM) ==========

    /**
     * 派生加密密钥——从固定口令 + 随机盐值生成 AES-GCM 密钥
     * 浏览器不支持 SubtleCrypto 时降级为 base64 混淆
     */
    var _cryptoOk = (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.encrypt);

    function getKeyPassphrase() {
        // 组合多个来源增加熵，但最终仍是客户端可计算的
        return "jiaopei_2025_salt_" + (navigator.language || "zh-CN") + "_deepseek_key_v13";
    }

    function getOrCreateSalt() {
        var saltHex = localStorage.getItem(C.STORAGE_API_KEY_SALT);
        if (saltHex && saltHex.length >= 24) return saltHex;
        // 生成 16 字节随机盐
        var arr = new Uint8Array(16);
        if (typeof crypto !== "undefined" && crypto.getRandomValues) {
            crypto.getRandomValues(arr);
        } else {
            for (var i = 0; i < 16; i++) { arr[i] = Math.floor(Math.random() * 256); }
        }
        var hex = Array.from(arr).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        localStorage.setItem(C.STORAGE_API_KEY_SALT, hex);
        return hex;
    }

    async function deriveKey(saltHex) {
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(getKeyPassphrase()), "PBKDF2", false, ["deriveKey"]
        );
        var salt = new Uint8Array(saltHex.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /** 加密 API Key → 存储为 hex */
    async function encryptApiKey(plaintext) {
        if (!_cryptoOk) {
            // 降级：base64 + 简单位移
            var b64 = btoa(unescape(encodeURIComponent(plaintext)));
            return "b64:" + b64.split("").reverse().join("");
        }
        try {
            var saltHex = getOrCreateSalt();
            var key = await deriveKey(saltHex);
            var iv = crypto.getRandomValues(new Uint8Array(12));
            var enc = new TextEncoder();
            var ciphertext = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, key, enc.encode(plaintext)
            );
            // 格式: iv(hex) + ":" + ciphertext(hex)
            var ivHex = Array.from(iv).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
            var ctHex = Array.from(new Uint8Array(ciphertext)).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
            return "aes:" + ivHex + ":" + ctHex;
        } catch (e) {
            console.warn("[storage] 加密失败，降级 base64:", e);
            var b64 = btoa(unescape(encodeURIComponent(plaintext)));
            return "b64:" + b64.split("").reverse().join("");
        }
    }

    /** 解密 API Key */
    async function decryptApiKey(encrypted) {
        if (!encrypted) return "";
        if (encrypted.indexOf("b64:") === 0) {
            var reversed = encrypted.slice(4).split("").reverse().join("");
            try { return decodeURIComponent(escape(atob(reversed))); } catch (e) { return ""; }
        }
        if (encrypted.indexOf("aes:") !== 0 || !_cryptoOk) return "";
        try {
            var parts = encrypted.slice(4).split(":");
            if (parts.length < 2) return "";
            var ivHex = parts[0], ctHex = parts[1];
            var iv = new Uint8Array(ivHex.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
            var ct = new Uint8Array(ctHex.match(/.{2}/g).map(function (b) { return parseInt(b, 16); }));
            var saltHex = getOrCreateSalt();
            var key = await deriveKey(saltHex);
            var plaintext = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, ct
            );
            return new TextDecoder().decode(plaintext);
        } catch (e) {
            console.warn("[storage] 解密失败:", e);
            return "";
        }
    }

    // ========== API Key 读写 ==========

    /** 获取解密后的 API Key (async) */
    MODULE.getApiKey = async function () {
        var encrypted = localStorage.getItem(C.STORAGE_API_KEY);
        if (!encrypted) return "";
        // 兼容旧版明文 key (v12)
        if (encrypted.indexOf("sk-") === 0) {
            // 自动迁移：读到旧版明文 key → 加密保存后返回
            var oldKey = encrypted;
            var newEnc = await encryptApiKey(oldKey);
            MODULE.safeSetItem(C.STORAGE_API_KEY, newEnc);
            return oldKey;
        }
        return await decryptApiKey(encrypted);
    };

    /** 加密保存 API Key */
    MODULE.saveApiKey = async function (key) {
        if (!key) { localStorage.removeItem(C.STORAGE_API_KEY); return true; }
        var encrypted = await encryptApiKey(key.trim());
        return MODULE.safeSetItem(C.STORAGE_API_KEY, encrypted);
    };

    /** 验证 API Key 有效性——发一个轻量请求 */
    MODULE.validateApiKey = async function (apiKey) {
        if (!apiKey || apiKey.length < 20) {
            return { ok: false, message: "密钥格式不正确" };
        }
        try {
            var response = await fetch("https://api.deepseek.com/v1/models", {
                method: "GET",
                headers: { "Authorization": "Bearer " + apiKey }
            });
            if (response.ok) {
                return { ok: true, message: "✅ API Key 有效" };
            } else if (response.status === 401 || response.status === 403) {
                return { ok: false, message: "❌ API Key 无效（" + response.status + "），请检查后重试" };
            } else {
                return { ok: true, message: "⚠️ 无法验证（" + response.status + "），已保存但建议测试" };
            }
        } catch (e) {
            return { ok: true, message: "⚠️ 网络不通，已保存但无法在线验证" };
        }
    };

    // ========== 迁移旧版 API Key ==========

    /** 从旧 key 迁移到加密存储 */
    MODULE.migrateApiKeyIfNeeded = async function () {
        var oldKey = localStorage.getItem("deepseek_api_key_v12");
        if (oldKey && oldKey.indexOf("sk-") === 0) {
            var encrypted = await encryptApiKey(oldKey);
            MODULE.safeSetItem(C.STORAGE_API_KEY, encrypted);
            localStorage.removeItem("deepseek_api_key_v12");
            return true;
        }
        return false;
    };

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

    // ========== 问候语开关 ==========
    MODULE.getGreetingSwitch = function () {
        var saved = localStorage.getItem(C.STORAGE_GREETING_SWITCH);
        return saved !== null ? saved === "true" : true;
    };
    MODULE.saveGreetingSwitch = function (enabled) {
        MODULE.safeSetItem(C.STORAGE_GREETING_SWITCH, enabled ? "true" : "false");
    };

    // ========== 增强版学生数据 (v2) ==========
    /**
     * 学生档案数据结构:
     * {
     *   name: string,           // 姓名
     *   gender: string,         // 性别
     *   grade: string,          // 年级
     *   subject: string,        // 科目
     *   notes: string,          // 备注（学习特点、性格等）
     *   sessions: [{            // 上课记录
     *     date: string,         // 日期 "YYYY-MM-DD"
     *     knowledge: string,    // 学习内容
     *     performance: string,  // 表现摘要
     *     highlights: string[], // 当次优点
     *     weaknesses: string[], // 当次问题
     *     correctness: number,  // 正确率 (0-100)
     *     feedback: string,     // 生成的反馈摘要
     *     createdAt: number
     *   }],
     *   tags: string[],         // 标签（如"基础薄弱""进步快""需关注"）
     *   createdAt: number,
     *   updatedAt: number
     * }
     */

    MODULE.getStudents = function () {
        var raw = safeGetJSON(C.STORAGE_STUDENTS, []);
        if (!Array.isArray(raw)) return [];

        // 兼容旧版 v1 数据迁移
        return raw.map(function (item) {
            if (!item) return null;
            return {
                name: item.name || "",
                gender: item.gender || "男",
                grade: item.grade || "初中",
                subject: item.subject || "数学",
                notes: item.notes || "",
                sessions: Array.isArray(item.sessions) ? item.sessions : [],
                tags: Array.isArray(item.tags) ? item.tags : [],
                createdAt: item.createdAt || item.updatedAt || Date.now(),
                updatedAt: item.updatedAt || Date.now()
            };
        }).filter(Boolean);
    };

    MODULE.saveStudents = function (list) {
        var cleaned = [];
        var seen = {};
        (Array.isArray(list) ? list : []).forEach(function (item) {
            var name = (item && item.name || "").replace(/\s+/g, "").trim();
            if (!name || seen[name]) return;
            seen[name] = true;
            cleaned.push({
                name: name,
                gender: item.gender || "男",
                grade: item.grade || "初中",
                subject: item.subject || "数学",
                notes: item.notes || "",
                sessions: Array.isArray(item.sessions) ? item.sessions.slice(-50) : [],
                tags: Array.isArray(item.tags) ? item.tags : [],
                createdAt: item.createdAt || Date.now(),
                updatedAt: Date.now()
            });
        });

        // 按拼音排序（复用 config 中的拼音数据）
        var collator = C.STUDENT_PINYIN_COLLATOR;
        function getPinyin(name) {
            var clean = name.replace(/\s+/g, "").trim();
            // 复姓检查
            var compoundKeys = Object.keys(C.STUDENT_COMPOUND_SURNAME_PINYIN);
            for (var i = 0; i < compoundKeys.length; i++) {
                if (clean.indexOf(compoundKeys[i]) === 0) {
                    return C.STUDENT_COMPOUND_SURNAME_PINYIN[compoundKeys[i]] || "";
                }
            }
            var surname = clean.charAt(0);
            return C.STUDENT_SURNAME_PINYIN[surname] || surname;
        }

        cleaned.sort(function (a, b) {
            var pa = getPinyin(a.name), pb = getPinyin(b.name);
            if (pa && pb && pa !== pb) return pa.localeCompare(pb, "en", { sensitivity: "base" });
            return collator.compare(a.name || "", b.name || "") || (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        MODULE.safeSetItem(C.STORAGE_STUDENTS, JSON.stringify(cleaned.slice(0, 300)));
    };

    /** 添加上课记录到学生档案 */
    MODULE.addStudentSession = function (studentName, session) {
        var profiles = MODULE.getStudents();
        var found = false;
        var cleanName = (studentName || "").replace(/\s+/g, "").trim();
        profiles.forEach(function (profile) {
            if (profile.name.replace(/\s+/g, "").trim() === cleanName) {
                found = true;
                if (!Array.isArray(profile.sessions)) profile.sessions = [];
                profile.sessions.push({
                    date: session.date || "",
                    knowledge: session.knowledge || "",
                    performance: session.performance || "",
                    highlights: session.highlights || [],
                    weaknesses: session.weaknesses || [],
                    correctness: session.correctness !== undefined ? session.correctness : null,
                    feedback: session.feedback || "",
                    createdAt: Date.now()
                });
                if (session.tags && Array.isArray(session.tags)) {
                    session.tags.forEach(function (t) {
                        if (t && profile.tags.indexOf(t) < 0) profile.tags.push(t);
                    });
                }
                if (session.notes) {
                    profile.notes = profile.notes
                        ? profile.notes + "；" + session.notes
                        : session.notes;
                }
                profile.updatedAt = Date.now();
            }
        });
        if (found) {
            MODULE.saveStudents(profiles);
        }
        return found;
    };

    /** 获取单个学生的学习历史 */
    MODULE.getStudentSessions = function (studentName) {
        var profile = null;
        var cleanName = (studentName || "").replace(/\s+/g, "").trim();
        MODULE.getStudents().forEach(function (p) {
            if (p.name.replace(/\s+/g, "").trim() === cleanName) profile = p;
        });
        return profile ? {
            profile: profile,
            sessions: profile.sessions || [],
            sessionCount: (profile.sessions || []).length,
            lastSession: (profile.sessions || []).length > 0
                ? profile.sessions[profile.sessions.length - 1]
                : null
        } : null;
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

    // ========== 容量管理 ==========

    /** 自动清理：删除最旧的反馈历史直到低于警告线 */
    MODULE.autoCleanup = function () {
        var report = MODULE.getStorageReport();
        if (report.status === "full") {
            // 清空反馈历史来释放空间
            MODULE.clearFeedbackHistory();
            var sessionsCleaned = 0;
            var students = MODULE.getStudents();
            students.forEach(function (p) {
                if (p.sessions && p.sessions.length > 20) {
                    p.sessions = p.sessions.slice(-10);
                    sessionsCleaned++;
                }
            });
            if (sessionsCleaned > 0) MODULE.saveStudents(students);
        }
        return MODULE.getStorageReport();
    };

    window.App.storage = MODULE;
})();
