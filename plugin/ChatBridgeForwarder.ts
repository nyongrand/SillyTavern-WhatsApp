import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import http from 'http';
import { APIKeyRotator } from './APIKeyRotator';
import fs from 'fs';
import path from 'path';

type RequestMap = Record<string, any>;

export class ChatBridgeForwarder {
  private settings: any;
  private wsClients: Set<WebSocket> = new Set();
  private keyRotator: APIKeyRotator;
  private responseFutures: RequestMap = {};

  constructor(settingsPath: string) {
    const settingsData = fs.readFileSync(settingsPath, 'utf-8');
    this.settings = JSON.parse(settingsData);
    this.keyRotator = new APIKeyRotator(this.settings.llm_api.api_keys);
  }

  async start() {
    // Setup HTTP + Express servers
    const userApp = express();
    userApp.use(express.json());
    const stApp = express();
    stApp.use(express.json());

    // User API routes
    userApp.post('/v1/chat/completions', this.handleUserAPI.bind(this));

    // ST API routes
    stApp.post('/chat/completions', this.handleChatCompletions.bind(this));
    stApp.post('/v1/chat/completions', this.handleChatCompletions.bind(this));
    stApp.get('/models', this.handleModels.bind(this));
    stApp.get('/v1/models', this.handleModels.bind(this));

    // HTTP Servers
    const userServer = http.createServer(userApp);
    const stServer = http.createServer(stApp);

    userServer.listen(this.settings.user_api.port, this.settings.user_api.host, () => {
      console.log(`User API running at http://${this.settings.user_api.host}:${this.settings.user_api.port}`);
    });

    stServer.listen(this.settings.st_api.port, this.settings.st_api.host, () => {
      console.log(`ST API running at http://${this.settings.st_api.host}:${this.settings.st_api.port}`);
    });

    // WebSocket Server
    const wsServer = new WebSocketServer({ port: this.settings.websocket.port });
    wsServer.on('connection', this.handleWebSocket.bind(this));

    console.log(`WebSocket running at ws://${this.settings.websocket.host}:${this.settings.websocket.port}`);
  }

  private handleWebSocket(ws: WebSocket) {
    this.wsClients.add(ws);
    ws.on('message', (msg: string) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'st_response' && this.responseFutures[data.id]) {
          const callback = this.responseFutures[data.id];
          callback(data.content);
        }
      } catch (err) {
        console.error('Invalid WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      this.wsClients.delete(ws);
    });
  }

  private async handleUserAPI(req: express.Request, res: express.Response) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${this.settings.user_api.api_key}`) {
      return res.status(401).send('Unauthorized');
    }

    const requestId = uuidv4();
    const requestData = req.body;
    const isStream = requestData.stream;

    if (!this.wsClients.size) {
      return res.status(503).send('No WebSocket clients connected');
    }

    const wsMsg = {
      type: 'user_request',
      id: requestId,
      content: requestData
    };

    const ws = [...this.wsClients][0];
    ws.send(JSON.stringify(wsMsg));

    this.responseFutures[requestId] = (data: any) => {
      delete this.responseFutures[requestId];
      res.json(data);
    };

    // Optional: add timeout handling here
  }

  private async handleModels(req: express.Request, res: express.Response) {
    const apiKey = this.keyRotator.getNextKey();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    try {
      const targetUrl = `${this.settings.llm_api.base_url}/models`;
      const response = await axios.get(targetUrl, { headers });
      res.json(response.data);
    } catch (err: any) {
      console.error('Model fetch failed:', err.message);
      res.status(500).send(err.message);
    }
  }

  private async handleChatCompletions(req: express.Request, res: express.Response) {
    const apiKey = this.keyRotator.getNextKey();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const targetUrl = `${this.settings.llm_api.base_url}/chat/completions`;

    try {
      const response = await axios.post(targetUrl, req.body, { headers });
      res.status(response.status).json(response.data);
    } catch (err: any) {
      console.error('Chat completion failed:', err.message);
      res.status(500).send(err.message);
    }
  }
}
