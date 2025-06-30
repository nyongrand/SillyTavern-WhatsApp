import { ChatBridgeForwarder } from './ChatBridgeForwarder';
import path from 'path';

async function main() {
  const settingsPath = path.join(__dirname, 'settings.json');
  const forwarder = new ChatBridgeForwarder(settingsPath);
  await forwarder.start();
}

main().catch(console.error);
