import { IService, NewsArticle, NewsScraperConfig } from '../types';
import { Logger } from '../utils/logger';
// import { eventBus } from '../utils/eventBus'; // TODO: uncomment when implementing news scraping

/**
 * News Scraper Service
 * Responsible for continuously scraping news from various sources
 */
export class NewsScraperService implements IService {
  private logger: Logger;
  private config: NewsScraperConfig;
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: NewsScraperConfig) {
    this.logger = new Logger('NewsScraperService');
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Service already running');
      return;
    }

    this.logger.info('Starting news scraper service', {
      sources: this.config.sources.length,
      interval: this.config.intervalMs,
    });

    this.running = true;

    // Initial scrape
    await this.scrapeNews();

    // Schedule periodic scraping
    this.intervalId = setInterval(() => {
      this.scrapeNews().catch(error => {
        this.logger.error('Error in scheduled news scrape', error);
      });
    }, this.config.intervalMs);

    this.logger.info('News scraper service started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Service not running');
      return;
    }

    this.logger.info('Stopping news scraper service');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.running = false;
    this.logger.info('News scraper service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Scrape news from all configured sources
   */
  private async scrapeNews(): Promise<void> {
    this.logger.debug('Starting news scrape cycle');

    // TODO: Implement actual news scraping logic
    // This is a placeholder for the architecture
    
    try {
      for (const source of this.config.sources) {
        await this.scrapeSource(source);
      }
    } catch (error) {
      this.logger.error('Error scraping news', error);
      throw error;
    }
  }

  /**
   * Scrape news from a single source
   */
  private async scrapeSource(source: string): Promise<void> {
    this.logger.debug(`Scraping news from source: ${source}`);

    // TODO: Implement source-specific scraping logic
    // Placeholder implementation
    
    // Example of how to emit news articles
    // const article: NewsArticle = {
    //   id: 'unique-id',
    //   title: 'Example Article',
    //   content: 'Article content',
    //   source: source,
    //   url: 'https://example.com/article',
    //   publishedAt: new Date(),
    // };
    // 
    // eventBus.emit('news:article', article);
  }

  /**
   * Filter news by keywords
   * TODO: Use this method when implementing news scraping
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private filterByKeywords(article: NewsArticle): boolean {
    if (!this.config.keywords || this.config.keywords.length === 0) {
      return true;
    }

    const text = `${article.title} ${article.content}`.toLowerCase();
    return this.config.keywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }
}
