import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "SillyTavern-WhatsApp";
const defaultSettings = {
  wsPort: 8001,
  autoConnect: false,
};

if (!extension_settings[extensionName]) {
  extension_settings[extensionName] = {};
}

Object.assign(extension_settings[extensionName], defaultSettings);

let ws;
let jid = null;

function updateDebugLog(message) {
  const debugLog = $("#debug_log");
  if (debugLog.length === 0) {
    console.warn("Debug log element not found");
    return;
  }
  const timestamp = new Date().toLocaleTimeString();
  const currentContent = debugLog.val();
  const newLine = `[${timestamp}] ${message}\n`;
  debugLog.val(currentContent + newLine);
  debugLog.scrollTop(debugLog[0].scrollHeight);
  // At the same time, it is output in the console for easy debugging
  console.log(`[${extensionName}] ${message}`);
}

function updateWSStatus(connected) {
  const status = $("#ws_status");
  if (connected) {
    status.text("Connected").css("color", "green");
  } else {
    status.text("Not connected").css("color", "red");
  }
}

function setupWebSocket() {
  const wsUrl = $("#ws_url").val();
  const wsPort = $("#ws_port").val();
  updateDebugLog(
    `Try connecting to the WebSocket server: ws://${wsUrl}:${wsPort}`
  );

  ws = new WebSocket(`ws://${wsUrl}:${wsPort}`);

  ws.onopen = () => {
    updateWSStatus(true);
    updateConnectionButtons(true);
    updateDebugLog("WebSocket connection established");
  };

  ws.onclose = () => {
    updateWSStatus(false);
    updateConnectionButtons(false);
    updateDebugLog("WebSocket connection closed");
  };

  ws.onerror = (error) => {
    updateWSStatus(false);
    updateDebugLog(`WebSocket Error: ${error}`);
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "user_request") {
        updateDebugLog("Receive user request");

        $("#send_textarea").val(data.content);
        $("#send_but").click();

        jid = data.jid;
      } else if (data.type === "qr_update") {
        updateDebugLog("QR Code received, please scan it:\n" + data.content);
      }
    } catch (error) {
      updateDebugLog(`Error processing message: ${error.message}`);
      console.error(error); // Output complete error message
    }
  };
}

// Handle SillyTavern response
eventSource.on(event_types.MESSAGE_RECEIVED, (chatId) => {
  if (ws && jid) {
    const message = getContext().chat.at(-1);
    if (message && !message.is_user && message.mes) {
      const wsMsg = {
        id: chatId,
        jid: jid,
        content: message.mes,
        type: "st_response",
      };

      ws.send(JSON.stringify(wsMsg));
      jid = null;
    }
  }
});

function updateConnectionButtons(connected) {
  $("#ws_connect").prop("disabled", connected);
  $("#ws_disconnect").prop("disabled", !connected);
  $("#ws_url").prop("disabled", connected);
  $("#ws_port").prop("disabled", connected);
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
  }
  updateWSStatus(false);
  updateConnectionButtons(false);
  updateDebugLog("WebSocket connection disconnected");
  // If automatic connection attempts are enabled, the timer starts immediately
  if (extension_settings[extensionName].autoConnect) {
    startAutoConnect();
  }
}

//Automatically try to connect
let autoConnectTimer = null;
//Automatically try to connect
function startAutoConnect() {
  if (autoConnectTimer) {
    clearInterval(autoConnectTimer);
  }

  autoConnectTimer = setInterval(() => {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      updateDebugLog("Automatically trying to connect...");
      setupWebSocket();
    }
  }, 5000);
}

function stopAutoConnect() {
  if (autoConnectTimer) {
    clearInterval(autoConnectTimer);
    autoConnectTimer = null;
  }
}

jQuery(async () => {
  const template = await $.get(
    `/scripts/extensions/third-party/${extensionName}/index.html`
  );
  $("#extensions_settings").append(template);

  $("#ws_connect").on("click", setupWebSocket);
  $("#ws_disconnect").on("click", disconnectWebSocket);
  $("#ws_port").val(extension_settings[extensionName].wsPort);

  $("#ws_port").on("change", function () {
    extension_settings[extensionName].wsPort = $(this).val();
    saveSettingsDebounced();
  });
  setupWebSocket();

  //Automatically try to connect
  $("#ws_auto_connect").prop(
    "checked",
    extension_settings[extensionName].autoConnect
  );
  // Add event handling for the automatic attempt to connect checkbox
  $("#ws_auto_connect").on("change", function () {
    const isChecked = $(this).prop("checked");
    extension_settings[extensionName].autoConnect = isChecked;
    saveSettingsDebounced();

    if (isChecked) {
      updateDebugLog("Automatically try to connect enabled");
      startAutoConnect();
    } else {
      updateDebugLog("Automatically attempt to connect disabled");
      stopAutoConnect();
    }
  });

  // If automatic connection attempts are enabled, a timer is started
  if (extension_settings[extensionName].autoConnect) {
    startAutoConnect();
  }

  updateDebugLog("Extension initialization completed");
});
