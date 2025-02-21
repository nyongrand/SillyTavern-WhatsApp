import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

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

async function sendChatHistory() {
    const context = getContext();
    if (ws && ws.readyState === WebSocket.OPEN && context.chat) {
        ws.send(JSON.stringify({
            type: 'chat_history',
            content: context.chat
        }));
        updateDebugLog('已发送聊天记录');
    }
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
        sendChatHistory();
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        updateDebugLog(`收到消息: ${JSON.stringify(data)}`);
        
        if (data.type === 'send_message') {
            $('#send_textarea').val(data.content);
            $('#send_but').click();
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

    // 监听所有事件
    // for (const eventType in context.eventTypes) {
    //     context.eventSource.on(context.eventTypes[eventType], (...args) => {
    //         updateDebugLog(`触发事件: ${eventType}`);
    //         if (args.length > 0) {
    //             updateDebugLog(`事件参数: ${JSON.stringify(args)}`);
    //         }
    //     });
    // }
    
    // 修改事件监听
    context.eventSource.on('GENERATION_STARTED', () => {
        updateDebugLog('开始生成回复...');
        streamingMessage = '';  // 重置流式消息
    });

    // 使用STREAM_TOKEN_RECEIVED事件
    context.eventSource.on(context.eventTypes.STREAM_TOKEN_RECEIVED, (chunk) => {
        updateDebugLog(`收到流式数据: ${chunk}`);
        streamingMessage = chunk; // 直接使用完整的chunk，因为它已经包含了完整的当前生成内容
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'stream_update',
                content: streamingMessage
            }));
        }
    });

    const template = await $.get(`/scripts/extensions/third-party/${extensionName}/index.html`);
    $('#extensions_settings').append(template);
    
    $('#ws_connect').on('click', setupWebSocket);
    $('#ws_disconnect').on('click', disconnectWebSocket);
    $('#ws_port').val(extension_settings[extensionName].wsPort);
    
    $('#ws_port').on('change', function() {
        extension_settings[extensionName].wsPort = $(this).val();
        saveSettingsDebounced();
    });

    context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => {
        updateDebugLog('检测到新的AI回复，同步聊天记录');
        sendChatHistory();  // AI回复时立即发送更新后的聊天记录
    });

    let streamingMessage = '';
    
    context.eventSource.on(context.eventTypes.GENERATION_STARTED, () => {
        updateDebugLog('开始生成回复...');
        streamingMessage = '';  // 重置流式消息
    });

    context.eventSource.on(context.eventTypes.TEXT_STREAM, (chunk) => {
        streamingMessage += chunk;
        // 发送流式更新
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'stream_update',
                content: streamingMessage
            }));
        }
    });

    // 保留原有的消息监听
    context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => {
        updateDebugLog('AI回复完成，同步完整聊天记录');
        sendChatHistory();
    });

    context.eventSource.on(context.eventTypes.MESSAGE_SENT, sendChatHistory);
    context.eventSource.on(context.eventTypes.MESSAGE_DELETED, sendChatHistory);
    context.eventSource.on(context.eventTypes.MESSAGE_EDITED, sendChatHistory);
    
    updateDebugLog('扩展初始化完成');
});