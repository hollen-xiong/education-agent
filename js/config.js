/**
 * config.js — 常量定义、默认数据、拼音字典
 * 依赖：无
 * 挂载：window.App.config
 */
(function () {
    "use strict";
    window.App = window.App || {};

    const MODULE = {};

    // ========== localStorage Key 常量 ==========
    MODULE.STORAGE_HIGHLIGHTS     = "feedback_advantages_v16_common_final";
    MODULE.STORAGE_WEAKPOINTS     = "feedback_disadvantages_v16_common_final";
    MODULE.STORAGE_SUGGESTIONS    = "feedback_suggestions_v12";
    MODULE.STORAGE_ENCOURAGEMENTS = "feedback_encouragements_v12";
    MODULE.STORAGE_API_KEY        = "deepseek_api_key_v12";
    MODULE.STORAGE_GREETING_SWITCH = "greeting_switch_enabled";
    MODULE.STORAGE_STUDENTS       = "feedback_students_memory_v1";
    MODULE.STORAGE_FEEDBACK_HISTORY = "feedback_history_v14_repeat_check";

    // ========== 应用常量 ==========
    MODULE.HISTORY_LIMIT = 12;
    MODULE.DEEPSEEK_MODEL = "deepseek-chat";

    // ========== 拼音排序 ==========
    MODULE.STUDENT_PINYIN_COLLATOR = new Intl.Collator("zh-Hans-CN-u-co-pinyin", {
        sensitivity: "base",
        numeric: true
    });

    MODULE.STUDENT_SURNAME_PINYIN = {
        "阿":"a", "艾":"ai", "安":"an", "敖":"ao",
        "巴":"ba", "白":"bai", "班":"ban", "包":"bao", "鲍":"bao", "贝":"bei", "贲":"ben", "毕":"bi", "边":"bian", "卞":"bian", "别":"bie", "邴":"bing", "柏":"bo", "薄":"bo", "卜":"bu", "步":"bu",
        "蔡":"cai", "曹":"cao", "岑":"cen", "柴":"chai", "常":"chang", "昌":"chang", "晁":"chao", "巢":"chao", "车":"che", "陈":"chen", "成":"cheng", "程":"cheng", "池":"chi", "褚":"chu", "储":"chu", "崔":"cui",
        "戴":"dai", "邓":"deng", "狄":"di", "刁":"diao", "丁":"ding", "董":"dong", "窦":"dou", "杜":"du", "段":"duan",
        "鄂":"e",
        "樊":"fan", "范":"fan", "方":"fang", "房":"fang", "费":"fei", "冯":"feng", "凤":"feng", "封":"feng", "符":"fu", "傅":"fu",
        "甘":"gan", "高":"gao", "葛":"ge", "耿":"geng", "龚":"gong", "巩":"gong", "贡":"gong", "勾":"gou", "顾":"gu", "谷":"gu", "关":"guan", "管":"guan", "桂":"gui", "郭":"guo",
        "韩":"han", "郝":"hao", "何":"he", "贺":"he", "洪":"hong", "侯":"hou", "胡":"hu", "花":"hua", "华":"hua", "黄":"huang", "霍":"huo",
        "姬":"ji", "吉":"ji", "计":"ji", "季":"ji", "纪":"ji", "贾":"jia", "简":"jian", "江":"jiang", "蒋":"jiang", "姜":"jiang", "焦":"jiao", "金":"jin", "靳":"jin", "景":"jing", "井":"jing",
        "康":"kang", "柯":"ke", "孔":"kong", "寇":"kou", "匡":"kuang", "蒯":"kuai",
        "赖":"lai", "蓝":"lan", "郎":"lang", "劳":"lao", "雷":"lei", "冷":"leng", "黎":"li", "李":"li", "厉":"li", "利":"li", "连":"lian", "廉":"lian", "梁":"liang", "廖":"liao", "林":"lin", "蔺":"lin", "凌":"ling", "刘":"liu", "柳":"liu", "龙":"long", "娄":"lou", "卢":"lu", "鲁":"lu", "路":"lu", "陆":"lu", "吕":"lv", "罗":"luo", "骆":"luo",
        "马":"ma", "麻":"ma", "满":"man", "毛":"mao", "梅":"mei", "蒙":"meng", "孟":"meng", "米":"mi", "苗":"miao", "闵":"min", "明":"ming", "莫":"mo", "牟":"mou", "穆":"mu",
        "倪":"ni", "年":"nian", "聂":"nie", "宁":"ning", "牛":"niu", "农":"nong",
        "欧":"ou", "区":"ou",
        "潘":"pan", "庞":"pang", "裴":"pei", "彭":"peng", "皮":"pi", "平":"ping", "蒲":"pu",
        "戚":"qi", "齐":"qi", "祁":"qi", "钱":"qian", "强":"qiang", "秦":"qin", "邱":"qiu", "丘":"qiu", "仇":"qiu", "屈":"qu", "曲":"qu", "瞿":"qu",
        "冉":"ran", "饶":"rao", "任":"ren", "荣":"rong", "容":"rong", "茹":"ru", "阮":"ruan",
        "单":"shan", "商":"shang", "邵":"shao", "佘":"she", "申":"shen", "沈":"shen", "盛":"sheng", "石":"shi", "史":"shi", "时":"shi", "舒":"shu", "司":"si", "宋":"song", "苏":"su", "孙":"sun",
        "谭":"tan", "汤":"tang", "唐":"tang", "陶":"tao", "滕":"teng", "田":"tian", "佟":"tong", "童":"tong", "涂":"tu", "屠":"tu",
        "万":"wan", "汪":"wang", "王":"wang", "危":"wei", "韦":"wei", "卫":"wei", "魏":"wei", "温":"wen", "文":"wen", "翁":"weng", "沃":"wo", "巫":"wu", "邬":"wu", "吴":"wu", "伍":"wu", "武":"wu",
        "奚":"xi", "席":"xi", "夏":"xia", "萧":"xiao", "肖":"xiao", "谢":"xie", "解":"xie", "辛":"xin", "邢":"xing", "熊":"xiong", "徐":"xu", "许":"xu", "薛":"xue",
        "严":"yan", "阎":"yan", "颜":"yan", "晏":"yan", "燕":"yan", "杨":"yang", "姚":"yao", "叶":"ye", "易":"yi", "殷":"yin", "尹":"yin", "应":"ying", "尤":"you", "游":"you", "于":"yu", "余":"yu", "俞":"yu", "虞":"yu", "袁":"yuan", "岳":"yue", "云":"yun",
        "臧":"zang", "曾":"zeng", "翟":"zhai", "詹":"zhan", "张":"zhang", "章":"zhang", "赵":"zhao", "郑":"zheng", "支":"zhi", "钟":"zhong", "周":"zhou", "朱":"zhu", "祝":"zhu", "庄":"zhuang", "卓":"zhuo", "宗":"zong", "邹":"zou", "左":"zuo"
    };

    MODULE.STUDENT_COMPOUND_SURNAME_PINYIN = {
        "欧阳":"ouyang", "太史":"taishi", "端木":"duanmu", "上官":"shangguan", "司马":"sima", "东方":"dongfang", "独孤":"dugu",
        "南宫":"nangong", "万俟":"moqi", "闻人":"wenren", "夏侯":"xiahou", "诸葛":"zhuge", "尉迟":"yuchi", "公羊":"gongyang",
        "赫连":"helian", "澹台":"tantai", "皇甫":"huangfu", "宗政":"zongzheng", "濮阳":"puyang", "公冶":"gongye", "太叔":"taishu",
        "申屠":"shentu", "公孙":"gongsun", "慕容":"murong", "仲孙":"zhongsun", "钟离":"zhongli", "长孙":"zhangsun",
        "宇文":"yuwen", "司徒":"situ", "鲜于":"xianyu", "司空":"sikong", "闾丘":"lvqiu", "子车":"ziche", "亓官":"qiguan",
        "司寇":"sikou", "巫马":"wuma", "公西":"gongxi", "颛孙":"zhuansun", "壤驷":"rangsi", "公良":"gongliang",
        "漆雕":"qidiao", "乐正":"yuezheng", "宰父":"zaifu", "谷梁":"guliang", "拓跋":"tuoba", "夹谷":"jiagu",
        "轩辕":"xuanyuan", "令狐":"linghu", "段干":"duangan", "百里":"baili", "呼延":"huyan", "东郭":"dongguo",
        "南门":"nanmen", "羊舌":"yangshe", "微生":"weisheng", "公户":"gonghu", "公玉":"gongyu", "公仪":"gongyi",
        "梁丘":"liangqiu", "公仲":"gongzhong", "公上":"gongshang", "公门":"gongmen", "公山":"gongshan", "公坚":"gongjian",
        "左丘":"zuoqiu", "公伯":"gongbo", "西门":"ximen", "公祖":"gongzu", "第五":"diwu", "公乘":"gongcheng",
        "贯丘":"guanqiu", "公皙":"gongxi", "南荣":"nanrong", "东里":"dongli", "东宫":"donggong", "仲长":"zhongchang"
    };

    // ========== 默认数据 ==========
    MODULE.DEFAULT_HIGHLIGHTS = [
        "基础题型基本过关",
        "讲过的方法能用出来",
        "能独立完成中档题",
        "解题思路清晰，能讲出来",
        "带着问题来上课",
        "状态比之前好一些",
        "学习态度端正",
        "笔记整理得不错",
        "作业完成情况良好",
        "课上互动比较积极",
        "课堂专注度较好",
        "主动订正错题",
        "答题步骤比之前规范",
        "正确率较高"
    ];

    MODULE.DEFAULT_WEAKPOINTS = [
        "基础知识点有遗忘",
        "讲过的题型还不能独立写出",
        "公式应用不熟",
        "做题正确率不稳定",
        "中难题需要提醒思路",
        "题目信息提取困难",
        "听懂了但是还是无法独自解题",
        "依赖老师提示",
        "计算容易出错",
        "审题不够细心",
        "解题步骤不够规范",
        "做题速度偏慢",
        "课后缺乏复习巩固",
        "错题未订正",
        "缺乏举一反三的能力",
        "作业完成度不达标",
        "有些自满",
        "不够自信",
        "课上互动不积极",
        "上课有些犯困"
    ];

    MODULE.DEFAULT_SUGGESTIONS = [
        "巩固基础概念", "强化计算能力", "突破中高难度题", "整理错题，自己总结方法",
        "注意休息，保证睡眠", "加强审题训练", "规范解题步骤", "按要求完成作业"
    ];

    MODULE.DEFAULT_ENCOURAGEMENTS = [
        "学生课上表现一般，课后要多下功夫。", "整体状态还可以，后面继续保持。",
        "继续努力，慢慢来，一步一步把问题解决。", "总体而言有进步，继续往前走。",
        "课后要认真完成老师布置的任务，不要松懈。", "这节课状态是可以的，后面保持住。"
    ];

    // ========== 历史去重候选短语 ==========
    MODULE.HISTORY_PHRASE_CANDIDATES = [
        "课上表现良好", "学习态度端正", "继续加油", "继续保持", "这一点先保持", "这一点可以保持", "后续还需要", "还需要继续巩固",
        "基础题型基本过关", "知识点基本都过关", "需要提醒思路", "中档偏上的题目", "状态还可以",
        "课后要多下功夫", "要引起重视", "整体表现不错", "掌握得还可以", "这部分内容",
        "后面继续", "不要松懈", "希望这次考试能发挥出自己的水平", "目前主要问题", "作业完成度不达标",
        "有待提高", "基础知识点有遗忘", "计算细节", "审题细节", "基础分一定要守住"
    ];

    // ========== 微信表情 ==========
    MODULE.WECHAT_EMOJI_TOKENS = [
        "[强]", "[偷笑]", "[愉快]", "[加油]", "[玫瑰]",
        "[叹气]", "[擦汗]", "[尴尬]", "[呲牙]", "[庆祝]",
        "[好的]", "[耶]", "[敲打]", "[拥抱]", "[囧]",
        "[失望]", "[裂开]", "[难过]"
    ];

    MODULE.WECHAT_EMOJI_REGEX = /\[(强|偷笑|愉快|加油|玫瑰|叹气|擦汗|尴尬|呲牙|庆祝|好的|耶|敲打|拥抱|囧|失望|裂开|难过)\]/g;

    // ========== 快速生成预设 ==========
    MODULE.QUICK_PRESETS = {
        "学霸|表扬鼓励": {
            highlights: ["基础题型基本过关", "讲过的方法能用出来", "能独立完成中档题", "解题思路清晰，能讲出来", "正确率较高"],
            weak: ["解题步骤不够规范", "缺乏举一反三的能力"],
            realNotes: ["课上能比较快接上老师思路", "基础题和中档题完成得比较顺"],
            toneHint: "以肯定为主，提醒细节规范和变式题继续提升。"
        },
        "学霸|批评提醒": {
            highlights: ["基础题型基本过关", "解题思路清晰，能讲出来", "正确率较高"],
            weak: ["有些自满", "审题不够细心", "解题步骤不够规范"],
            realNotes: ["整体基础不差，但细节上有放松", "会做的题也要把步骤写稳"],
            toneHint: "基础可以肯定，但要直接提醒不能因为会做就放松细节。"
        },
        "普通学生|表扬鼓励": {
            highlights: ["讲过的方法能用出来", "状态比之前好一些", "学习态度端正", "课上互动比较积极"],
            weak: ["做题正确率不稳定", "中难题需要提醒思路", "课后缺乏复习巩固"],
            realNotes: ["课上能跟着老师思路走", "中档题还需要多练几遍才稳"],
            toneHint: "先肯定正常状态和愿意配合，再提醒稳定性。"
        },
        "普通学生|批评提醒": {
            highlights: ["学习态度端正", "讲过的方法能用出来"],
            weak: ["讲过的题型还不能独立写出", "做题正确率不稳定", "依赖老师提示", "课后缺乏复习巩固"],
            realNotes: ["听课能跟上，但自己完整写出来还不够稳", "课后需要把讲过的题重新独立做一遍"],
            toneHint: "语气直接一点，重点提醒听懂不等于掌握。"
        },
        "学渣|表扬鼓励": {
            highlights: ["学习态度端正", "状态比之前好一些", "课上互动比较积极"],
            weak: ["基础知识点有遗忘", "讲过的题型还不能独立写出", "计算容易出错", "课后缺乏复习巩固"],
            realNotes: ["基础还需要补，但课上愿意跟着走", "简单题先争取稳定做对"],
            toneHint: "先抓住一点可肯定的状态，再把基础和课后复习说清楚。"
        },
        "学渣|批评提醒": {
            highlights: ["学习态度端正"],
            weak: ["基础知识点有遗忘", "讲过的题型还不能独立写出", "听懂了但是还是无法独自解题", "依赖老师提示", "课后缺乏复习巩固"],
            realNotes: ["基础题型还不够稳", "听懂以后还需要自己重新写出来"],
            toneHint: "问题要说清楚，但不要打击学生；重点提醒基础和课后落实。"
        }
    };

    window.App.config = MODULE;
})();
