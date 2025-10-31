import { config, validateConfig } from './config';
import { Logger } from './utils/logger';
import { NewsScraperService } from './services/NewsScraperService';
import { MarketDataService } from './services/MarketDataService';
import { TradingEngineService } from './services/TradingEngineService';
import { NotificationService } from './services/NotificationService';

/**
 * Main Application Class
 * Orchestrates all services and manages application lifecycle
 */
class TradingBotApplication {
  private logger: Logger;
  private newsScraperService: NewsScraperService;
  private marketDataService: MarketDataService;
  private tradingEngineService: TradingEngineService;
  private notificationService: NotificationService;
  private isShuttingDown: boolean = false;

  constructor() {
    this.logger = new Logger('TradingBotApplication');
    
    // Initialize services
    this.newsScraperService = new NewsScraperService(config.newsScraper);
    this.marketDataService = new MarketDataService(
      config.finnhub.apiKey,
      config.finnhub.wsUrl
    );
    this.tradingEngineService = new TradingEngineService(config.trading);
    this.notificationService = new NotificationService(config.email);
  }

  /**
   * Start the trading bot application
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting Trading Bot Application');
      this.logger.info(`Environment: ${config.env}`);

      // Validate configuration
      validateConfig();

      // Start all services in order
      await this.startServices();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      this.logger.info('Trading Bot Application started successfully');
      this.logger.info('Press CTRL+C to stop');

    } catch (error) {
      this.logger.error('Failed to start application', error);
      await this.stop();
      process.exit(1);
    }
  }

  /**
   * Start all services
   */
  private async startServices(): Promise<void> {
    this.logger.info('Starting services...');

    try {
      // Start notification service first (so we can send alerts)
      await this.notificationService.start();
      this.logger.info('✓ Notification service started');

      // Start trading engine service
      await this.tradingEngineService.start();
      this.logger.info('✓ Trading engine service started');

      // Start market data service
      await this.marketDataService.start();
      this.logger.info('✓ Market data service started');

      // Subscribe to some default symbols for testing
      this.marketDataService.subscribe('AAPL');
      this.marketDataService.subscribe('MSFT');
      this.marketDataService.subscribe('GOOGL');
      this.marketDataService.subscribe('TSLA');
      this.logger.info('✓ Subscribed to test symbols: AAPL, MSFT, GOOGL, TSLA');

      // Start news scraper service
      await this.newsScraperService.start();
      this.logger.info('✓ News scraper service started');

      this.logger.info('All services started successfully');
    } catch (error) {
      this.logger.error('Error starting services', error);
      throw error;
    }
  }

  /**
   * Stop the trading bot application
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Stopping Trading Bot Application');

    try {
      // Stop services in reverse order
      if (this.newsScraperService.isRunning()) {
        await this.newsScraperService.stop();
        this.logger.info('✓ News scraper service stopped');
      }

      if (this.marketDataService.isRunning()) {
        await this.marketDataService.stop();
        this.logger.info('✓ Market data service stopped');
      }

      if (this.tradingEngineService.isRunning()) {
        await this.tradingEngineService.stop();
        this.logger.info('✓ Trading engine service stopped');
      }

      if (this.notificationService.isRunning()) {
        await this.notificationService.stop();
        this.logger.info('✓ Notification service stopped');
      }

      this.logger.info('Trading Bot Application stopped successfully');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal} signal`);
        await this.stop();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      this.logger.error('Uncaught exception', error);
      await this.stop();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: any) => {
      this.logger.error('Unhandled promise rejection', reason);
      await this.stop();
      process.exit(1);
    });
  }
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
  const app = new TradingBotApplication();
  await app.start();
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
