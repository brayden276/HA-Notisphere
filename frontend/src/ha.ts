export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface HomeAssistantWebSocketClient {
  callWS<T>(message: WebSocketMessage): Promise<T>;
}

export interface HomeAssistantConnection {
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}

export interface HomeAssistant extends HomeAssistantWebSocketClient {
  connection: HomeAssistantConnection;
  locale?: {
    language: string;
  };
}

export interface PanelConfig {
  domain?: string;
}
