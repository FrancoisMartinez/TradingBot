/**
 * Base interface for all services
 */
export interface IService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * Market data interfaces
 */
export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export interface MarketDataSubscription {
  symbols: string[];
  onTick: (tick: MarketTick) => void;
  onError: (error: Error) => void;
}

/**
 * News scraper interfaces
 */
export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevantSymbols?: string[];
}

export interface NewsScraperConfig {
  sources: string[];
  intervalMs: number;
  keywords?: string[];
}

/**
 * Trading signal interfaces
 */
export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  quantity?: number;
  reason: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TradingEngineConfig {
  serviceUrl: string;
  apiKey: string;
  timeout?: number;
}

/**
 * Notification interfaces
 */
export interface NotificationMessage {
  subject: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  finnhub: {
    apiKey: string;
    wsUrl: string;
  };
  trading: TradingEngineConfig;
  email: EmailConfig;
  newsScraper: NewsScraperConfig;
}
