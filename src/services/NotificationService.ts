import nodemailer from 'nodemailer';
import { IService, NotificationMessage, EmailConfig } from '../types';
import { Logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

/**
 * Notification Service
 * Handles sending notifications via email and other channels
 */
export class NotificationService implements IService {
  private logger: Logger;
  private config: EmailConfig;
  private running: boolean = false;
  private transporter?: nodemailer.Transporter;
  private messageQueue: NotificationMessage[] = [];
  private processing: boolean = false;

  constructor(config: EmailConfig) {
    this.logger = new Logger('NotificationService');
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Service already running');
      return;
    }

    this.logger.info('Starting notification service');
    this.running = true;

    // Initialize email transporter
    await this.initializeEmailTransporter();

    // Setup event listeners
    this.setupEventListeners();

    this.logger.info('Notification service started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Service not running');
      return;
    }

    this.logger.info('Stopping notification service');
    this.running = false;

    // Process remaining messages
    if (this.messageQueue.length > 0) {
      this.logger.info(`Processing ${this.messageQueue.length} remaining messages`);
      await this.processQueue();
    }

    this.removeEventListeners();
    this.logger.info('Notification service stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Initialize email transporter
   */
  private async initializeEmailTransporter(): Promise<void> {
    try {
      // TODO: Implement actual email transporter
      // this.transporter = nodemailer.createTransport({
      //   host: this.config.host,
      //   port: this.config.port,
      //   secure: this.config.secure,
      //   auth: {
      //     user: this.config.user,
      //     pass: this.config.password,
      //   },
      // });

      // Verify connection
      // await this.transporter.verify();
      // this.logger.info('Email transporter initialized and verified');
      
      this.logger.info('Email transporter placeholder initialized');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    eventBus.on('trading:signal', this.handleTradingSignal.bind(this));
    eventBus.on('trading:executed', this.handleTradingExecuted.bind(this));
    eventBus.on('trading:execution-failed', this.handleExecutionFailed.bind(this));
    eventBus.on('market:connection-lost', this.handleConnectionLost.bind(this));
    eventBus.on('news:article', this.handleHighPriorityNews.bind(this));
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    eventBus.removeAllListeners('trading:signal');
    eventBus.removeAllListeners('trading:executed');
    eventBus.removeAllListeners('trading:execution-failed');
    eventBus.removeAllListeners('market:connection-lost');
  }

  /**
   * Handle trading signal event
   */
  private handleTradingSignal(signal: any): void {
    const message: NotificationMessage = {
      subject: `Trading Signal: ${signal.action} ${signal.symbol}`,
      body: this.formatTradingSignal(signal),
      priority: signal.confidence > 0.8 ? 'high' : 'medium',
      timestamp: new Date(),
      metadata: { type: 'trading-signal', signal },
    };

    this.queueMessage(message);
  }

  /**
   * Handle trading executed event
   */
  private handleTradingExecuted(signal: any): void {
    const message: NotificationMessage = {
      subject: `Trade Executed: ${signal.action} ${signal.symbol}`,
      body: this.formatTradeExecution(signal),
      priority: 'high',
      timestamp: new Date(),
      metadata: { type: 'trade-executed', signal },
    };

    this.queueMessage(message);
  }

  /**
   * Handle execution failed event
   */
  private handleExecutionFailed(signal: any): void {
    const message: NotificationMessage = {
      subject: `Trade Execution Failed: ${signal.symbol}`,
      body: `Failed to execute ${signal.action} for ${signal.symbol}. Manual intervention may be required.`,
      priority: 'high',
      timestamp: new Date(),
      metadata: { type: 'execution-failed', signal },
    };

    this.queueMessage(message);
  }

  /**
   * Handle market connection lost event
   */
  private handleConnectionLost(): void {
    const message: NotificationMessage = {
      subject: 'ALERT: Market Data Connection Lost',
      body: 'Connection to market data feed has been lost. System may not be receiving real-time data.',
      priority: 'high',
      timestamp: new Date(),
      metadata: { type: 'connection-lost' },
    };

    this.queueMessage(message);
  }

  /**
   * Handle high priority news
   */
  private handleHighPriorityNews(article: any): void {
    // Only notify for high-priority news
    if (article.sentiment === 'positive' || article.sentiment === 'negative') {
      const message: NotificationMessage = {
        subject: `News Alert: ${article.title}`,
        body: this.formatNewsArticle(article),
        priority: 'medium',
        timestamp: new Date(),
        metadata: { type: 'news-alert', article },
      };

      this.queueMessage(message);
    }
  }

  /**
   * Queue a message for sending
   */
  private queueMessage(message: NotificationMessage): void {
    this.messageQueue.push(message);
    this.logger.debug('Message queued', { subject: message.subject, priority: message.priority });

    // Process queue if not already processing
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process message queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.messageQueue.length > 0 && this.running) {
      const message = this.messageQueue.shift()!;
      await this.sendEmail(message);
      
      // Add small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.processing = false;
  }

  /**
   * Send email notification
   */
  private async sendEmail(message: NotificationMessage): Promise<void> {
    try {
      this.logger.info('Sending email notification', { subject: message.subject });

      // TODO: Implement actual email sending
      // const mailOptions = {
      //   from: this.config.from,
      //   to: this.config.to,
      //   subject: message.subject,
      //   text: message.body,
      //   html: this.formatHtmlEmail(message),
      // };

      // await this.transporter!.sendMail(mailOptions);
      // this.logger.info('Email sent successfully');
      
      this.logger.debug('Email placeholder sent', { subject: message.subject });
    } catch (error) {
      this.logger.error('Failed to send email', error, { subject: message.subject });
    }
  }

  /**
   * Format trading signal for email
   */
  private formatTradingSignal(signal: any): string {
    return `
Trading Signal Generated:

Symbol: ${signal.symbol}
Action: ${signal.action}
Price: $${signal.price}
Confidence: ${(signal.confidence * 100).toFixed(2)}%
Reason: ${signal.reason}
Timestamp: ${new Date(signal.timestamp).toLocaleString()}

This is an automated notification from your Trading Bot.
    `.trim();
  }

  /**
   * Format trade execution for email
   */
  private formatTradeExecution(signal: any): string {
    return `
Trade Successfully Executed:

Symbol: ${signal.symbol}
Action: ${signal.action}
Price: $${signal.price}
Timestamp: ${new Date(signal.timestamp).toLocaleString()}

This is an automated notification from your Trading Bot.
    `.trim();
  }

  /**
   * Format news article for email
   */
  private formatNewsArticle(article: any): string {
    return `
News Article Detected:

Title: ${article.title}
Source: ${article.source}
Sentiment: ${article.sentiment || 'neutral'}
Published: ${new Date(article.publishedAt).toLocaleString()}
URL: ${article.url}

Summary: ${article.content.substring(0, 500)}...

This is an automated notification from your Trading Bot.
    `.trim();
  }

  /**
   * Format HTML email (placeholder)
   */
  private formatHtmlEmail(message: NotificationMessage): string {
    // TODO: Implement HTML email template
    return `
      <html>
        <body>
          <h2>${message.subject}</h2>
          <pre>${message.body}</pre>
        </body>
      </html>
    `;
  }
}
