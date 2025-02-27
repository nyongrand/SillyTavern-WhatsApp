import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { chat } from "../../../../script.js";

const extensionName = "SillyTavern-Extension-ChatBridge";
const defaultSettings = {
    wsPort: 8001
};

if (!extension_settings[extensionName]) {
    extension_settings[extensionName] = {};
}

Object.assign(extension_settings[extensionName], defaultSettings);

let ws;
    
function updateDebugLog(message) {
    const debugLog = $('#debug_log');
    if (debugLog.length === 0) {
        console.warn('找不到调试日志元素');
        return;
    }
    const timestamp = new Date().toLocaleTimeString();
    const currentContent = debugLog.val();
    const newLine = `[${timestamp}] ${message}\n`;
    debugLog.val(currentContent + newLine);
    debugLog.scrollTop(debugLog[0].scrollHeight);
    // 同时在控制台输出，方便调试
    console.log(`[${extensionName}] ${message}`);
}

function updateWSStatus(connected) {
    const status = $('#ws_status');
    if (connected) {
        status.text('已连接').css('color', 'green');
    } else {
        status.text('未连接').css('color', 'red');
    }
}
function convertOpenAIToSTMessage(msg) {
    const isUser = msg.role === 'user';
    const currentTime = new Date().toLocaleString();
    
    return {
        name: isUser ? 'user' : 'Assistant', // 注意：用户名要小写
        is_user: isUser,
        is_system: false,
        send_date: currentTime,
        mes: msg.content,
        extra: {
            isSmallSys: false,
            token_count: 0,
            reasoning: ''
        },
        force_avatar: isUser ? "User Avatars/1739777502672-user.png" : null
    };
}

function setupWebSocket() {
    const wsUrl = $('#ws_url').val();
    const wsPort = $('#ws_port').val();
    updateDebugLog(`尝试连接WebSocket服务器: ws://${wsUrl}:${wsPort}`);
    
    ws = new WebSocket(`ws://${wsUrl}:${wsPort}`);

    ws.onopen = () => {
        updateWSStatus(true);
        updateConnectionButtons(true);
        updateDebugLog('WebSocket连接已建立');
        //sendChatHistory();
    };
    ws.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            updateDebugLog(`收到消息: ${JSON.stringify(data)}`);
            
            if(data.type === 'user_request') {
                updateDebugLog('收到用户请求');
                const context = getContext();
                
                if (data.content?.messages) {
                    const newChat = data.content.messages
                        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                        .map(msg => convertOpenAIToSTMessage(msg));
                    
                    chat.splice(0, chat.length, ...newChat);  
                    context.reloadCurrentChat();
                    
                    updateDebugLog(`已更新聊天内容，共${context.chat.length}条消息`);
                } else {
                    updateDebugLog('错误：消息格式不正确');
                }
            }
        } catch (error) {
            updateDebugLog(`处理消息时出错: ${error.message}`);
            console.error(error); // 输出完整错误信息
        }
    };
    ws.onclose = () => {
        updateWSStatus(false);
        updateConnectionButtons(false);
        updateDebugLog('WebSocket连接已关闭');
    };

    ws.onerror = (error) => {
        updateWSStatus(false);
        updateDebugLog(`WebSocket错误: ${error}`);
    };
}

function updateConnectionButtons(connected) {
    $('#ws_connect').prop('disabled', connected);
    $('#ws_disconnect').prop('disabled', !connected);
    $('#ws_url').prop('disabled', connected);
    $('#ws_port').prop('disabled', connected);
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
    }
    updateWSStatus(false);
    updateConnectionButtons(false);
    updateDebugLog('已断开WebSocket连接');
}


jQuery(async () => {
    const context = getContext();

    // 添加事件系统测试代码
    updateDebugLog('=== 可用事件类型 ===');
    for (const eventType in context.eventTypes) {
        updateDebugLog(`${eventType}: ${context.eventTypes[eventType]}`);
    }

    const template = await $.get(`/scripts/extensions/third-party/${extensionName}/index.html`);
    $('#extensions_settings').append(template);
    
    $('#ws_connect').on('click', setupWebSocket);
    $('#ws_disconnect').on('click', disconnectWebSocket);
    $('#ws_port').val(extension_settings[extensionName].wsPort);
    
    $('#ws_port').on('change', function() {
        extension_settings[extensionName].wsPort = $(this).val();
        saveSettingsDebounced();
    });

    updateDebugLog('扩展初始化完成');

    $('#show_chat').on('click', () => {
        const context = getContext();
        
        updateDebugLog('=== 当前聊天状态 ===');
        updateDebugLog(`全局chat长度: ${chat.length}`);
        updateDebugLog(`context.chat长度: ${context.chat.length}`);
        updateDebugLog(`chat === context.chat: ${chat === context.chat}`);
        updateDebugLog('当前聊天内容:');
        updateDebugLog(JSON.stringify(context.chat, null, 2));
    });

    $('#replace_chat').on('click', () => {
        const context = getContext();
        
        const nativeChat = [
            {
                "name": "user",
                "is_user": true,
                "is_system": false,
                "send_date": "February 26, 2025 2:09pm",
                "mes": "？",
                "extra": {
                    "isSmallSys": false,
                    "token_count": 2,
                    "reasoning": ""
                },
                "force_avatar": "User Avatars/1739777502672-user.png"
            },
            {
                "extra": {
                    "api": "custom",
                    "model": "gemini-2.0-flash-exp",
                    "reasoning": "",
                    "reasoning_duration": null,
                    "token_count": 64
                },
                "name": "测试",
                "is_user": false,
                "send_date": "February 26, 2025 2:09pm",
                "mes": "我不太确定你在问什么。你可以更详细地说明你的问题吗？",
                "title": "",
                "gen_started": "2025-02-26T06:09:43.173Z",
                "gen_finished": "2025-02-26T06:09:45.338Z",
                "swipe_id": 0,
                "swipes": ["我不太确定你在问什么。你可以更详细地说明你的问题吗？"],
                "swipe_info": [{
                    "send_date": "February 26, 2025 2:09pm",
                    "gen_started": "2025-02-26T06:09:43.173Z",
                    "gen_finished": "2025-02-26T06:09:45.338Z",
                    "extra": {
                        "api": "custom",
                        "model": "gemini-2.0-flash-exp",
                        "reasoning": "",
                        "reasoning_duration": null,
                        "token_count": 64
                    }
                }]
            }
        ];
    
        try {
            chat.splice(0, chat.length, ...nativeChat);
            context.reloadCurrentChat();
        } catch (error) {
            updateDebugLog(`替换聊天时出错: ${error.message}`);
            console.error(error);
        }
    });

    updateDebugLog('测试功能已初始化');
});