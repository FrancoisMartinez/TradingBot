import WebSocket from 'ws';
import { IService, MarketTick } from '../types';
import { Logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

/**
 * Finnhub WebSocket message types
 */
interface FinnhubTradeMessage {
  type: 'trade';
  data: Array<{
    s: string;  // Symbol
    p: number;  // Price
    v: number;  // Volume
    t: number;  // Timestamp
    c: string[]; // Conditions
  }>;
}

interface FinnhubPingMessage {
  type: 'ping';
}

type FinnhubMessage = FinnhubTradeMessage | FinnhubPingMessage;

/**
 * Market Data Service
 * Manages WebSocket connection to Finnhub for real-time market data
 */
export class MarketDataService implements IService {
  private logger: Logger;
  private apiKey: string;
  private wsUrl: string;
  private ws?: WebSocket;
  private running: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private subscribedSymbols: Set<string> = new Set();
  private pingInterval?: NodeJS.Timeout;
  private connectionTimeout?: NodeJS.Timeout;

  constructor(apiKey: string, wsUrl: string) {
    this.logger = new Logger('MarketDataService');
    this.apiKey = apiKey;
    this.wsUrl = wsUrl;
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Service already running');
      return;
    }

    this.logger.info('Starting market data service');
    this.running = true;
    await this.connect();
    this.logger.info('Market data service started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Service not running');
      return;
    }

    this.logger.info('Stopping market data service');
    this.running = false;

    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    this.subscribedSymbols.clear();
    this.logger.info('Market data service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Subscribe to market data for a symbol
   */
  subscribe(symbol: string): void {
    if (!this.running || !this.ws) {
      this.logger.error('Cannot subscribe - service not running');
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not ready, queuing subscription', { symbol });
      this.subscribedSymbols.add(symbol);
      return;
    }

    this.logger.info(`Subscribing to ${symbol}`);
    this.subscribedSymbols.add(symbol);
    
    const subscribeMessage = JSON.stringify({
      type: 'subscribe',
      symbol: symbol
    });
    
    this.ws.send(subscribeMessage);
    this.logger.debug('Sent subscribe message', { symbol });
  }

  /**
   * Unsubscribe from market data for a symbol
   */
  unsubscribe(symbol: string): void {
    if (!this.running || !this.ws) {
      this.logger.error('Cannot unsubscribe - service not running');
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not ready', { symbol });
      this.subscribedSymbols.delete(symbol);
      return;
    }

    this.logger.info(`Unsubscribing from ${symbol}`);
    this.subscribedSymbols.delete(symbol);
    
    const unsubscribeMessage = JSON.stringify({
      type: 'unsubscribe',
      symbol: symbol
    });
    
    this.ws.send(unsubscribeMessage);
    this.logger.debug('Sent unsubscribe message', { symbol });
  }

  /**
   * Get list of currently subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * Connect to Finnhub WebSocket
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.wsUrl}?token=${this.apiKey}`;
        this.logger.debug('Connecting to Finnhub WebSocket', { url: this.wsUrl });
        
        this.ws = new WebSocket(url);

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.logger.error('Connection timeout');
            this.ws.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

        this.ws.on('open', () => {
          this.logger.info('WebSocket connected successfully');
          this.reconnectAttempts = 0;
          
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = undefined;
          }

          // Resubscribe to all symbols
          this.resubscribeAll();

          // Setup ping interval to keep connection alive
          this.setupPingInterval();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          this.logger.error('WebSocket error', error);
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(error);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason.toString();
          this.logger.warn('WebSocket disconnected', { code, reason: reasonStr });
          
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
          }

          this.handleDisconnect();
        });

        this.ws.on('ping', () => {
          this.logger.debug('Received ping from server');
        });

        this.ws.on('pong', () => {
          this.logger.debug('Received pong from server');
        });

      } catch (error) {
        this.logger.error('Failed to connect to WebSocket', error);
        reject(error);
      }
    });
  }

  /**
   * Setup ping interval to keep connection alive
   */
  private setupPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.logger.debug('Sent ping to server');
      }
    }, 30000);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: FinnhubMessage = JSON.parse(data.toString());
      
      if (message.type === 'ping') {
        this.logger.debug('Received ping message');
        return;
      }

      if (message.type === 'trade' && message.data) {
        this.logger.debug('Received trade data', { count: message.data.length });
        
        message.data.forEach(trade => {
          const tick: MarketTick = {
            symbol: trade.s,
            price: trade.p,
            volume: trade.v,
            timestamp: trade.t,
          };
          
          this.logger.debug('Market tick', tick);
          eventBus.emit('market:tick', tick);
        });
      }
      
    } catch (error) {
      this.logger.error('Error handling WebSocket message', error, { 
        data: data.toString().substring(0, 200) 
      });
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(): void {
    if (!this.running) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      this.logger.info(
        `Attempting to reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      
      setTimeout(() => {
        if (this.running) {
          this.connect().catch(error => {
            this.logger.error('Reconnection failed', error);
          });
        }
      }, delay);
    } else {
      this.logger.error('Max reconnect attempts reached');
      eventBus.emit('market:connection-lost');
    }
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    if (this.subscribedSymbols.size === 0) {
      this.logger.debug('No symbols to resubscribe');
      return;
    }

    this.logger.info('Resubscribing to all symbols', { count: this.subscribedSymbols.size });
    
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    
    symbols.forEach(symbol => {
      this.subscribe(symbol);
    });
  }
}
