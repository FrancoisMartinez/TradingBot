import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Parse comma-separated string into array
 */
function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Get environment variable or throw error if missing
 */
function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get environment variable with default value
 */
function getEnvVarOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Application configuration singleton
 */
export const config: AppConfig = {
  env: (getEnvVarOrDefault('NODE_ENV', 'development') as AppConfig['env']),
  logLevel: (getEnvVarOrDefault('LOG_LEVEL', 'info') as AppConfig['logLevel']),
  
  finnhub: {
    apiKey: getEnvVar('FINNHUB_API_KEY'),
    wsUrl: getEnvVarOrDefault('FINNHUB_WS_URL', 'wss://ws.finnhub.io'),
  },
  
  trading: {
    serviceUrl: getEnvVar('TRADING_SERVICE_URL'),
    apiKey: getEnvVar('TRADING_SERVICE_API_KEY'),
    timeout: parseInt(getEnvVarOrDefault('TRADING_SERVICE_TIMEOUT', '30000'), 10),
  },
  
  email: {
    host: getEnvVar('EMAIL_HOST'),
    port: parseInt(getEnvVar('EMAIL_PORT'), 10),
    secure: getEnvVarOrDefault('EMAIL_SECURE', 'false') === 'true',
    user: getEnvVar('EMAIL_USER'),
    password: getEnvVar('EMAIL_PASSWORD'),
    from: getEnvVar('EMAIL_FROM'),
    to: getEnvVar('EMAIL_TO'),
  },
  
  newsScraper: {
    sources: parseArray(process.env.NEWS_SOURCES),
    intervalMs: parseInt(getEnvVarOrDefault('NEWS_SCRAPER_INTERVAL_MS', '300000'), 10),
    keywords: parseArray(process.env.NEWS_KEYWORDS),
  },
};

/**
 * Validate configuration on load
 */
export function validateConfig(): void {
  // Add any additional validation logic here
  if (config.newsScraper.intervalMs < 60000) {
    throw new Error('News scraper interval must be at least 60000ms (1 minute)');
  }
  
  if (config.email.port < 1 || config.email.port > 65535) {
    throw new Error('Invalid email port number');
  }
  
  console.log('Configuration validated successfully');
}
