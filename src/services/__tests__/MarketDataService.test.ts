import WebSocket from 'ws';
import { MarketDataService } from '../MarketDataService';
import { eventBus } from '../../utils/eventBus';

// Mock the ws module
jest.mock('ws');

// Mock the event bus
jest.mock('../../utils/eventBus', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

describe('MarketDataService', () => {
  let service: MarketDataService;
  let mockWebSocket: any;
  const API_KEY = 'test_api_key';
  const WS_URL = 'wss://test.finnhub.io';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock WebSocket instance
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWebSocket);

    // Create service instance
    service = new MarketDataService(API_KEY, WS_URL);
  });

  afterEach(async () => {
    if (service.isRunning()) {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    test('should start service and connect to WebSocket', async () => {
      const startPromise = service.start();

      // Simulate WebSocket open event
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();

      await startPromise;

      expect(WebSocket).toHaveBeenCalledWith(`${WS_URL}?token=${API_KEY}`);
      expect(service.isRunning()).toBe(true);
    });

    test('should not start service if already running', async () => {
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;

      // Try to start again
      await service.start();

      // WebSocket should only be created once
      expect(WebSocket).toHaveBeenCalledTimes(1);
    });

    test('should stop service and close WebSocket connection', async () => {
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;

      await service.stop();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(service.isRunning()).toBe(false);
    });

    test('should handle connection timeout', async () => {
      jest.useFakeTimers();

      const startPromise = service.start();

      // Don't trigger open event, let it timeout
      await jest.advanceTimersByTimeAsync(10000);

      await expect(startPromise).rejects.toThrow('WebSocket connection timeout');
      expect(mockWebSocket.terminate).toHaveBeenCalled();

      jest.useRealTimers();
    }, 20000); // Increase timeout for this test
  });

  describe('Symbol Subscription', () => {
    beforeEach(async () => {
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;
    });

    test('should subscribe to a symbol', () => {
      service.subscribe('AAPL');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', symbol: 'AAPL' })
      );
      expect(service.getSubscribedSymbols()).toContain('AAPL');
    });

    test('should subscribe to multiple symbols', () => {
      service.subscribe('AAPL');
      service.subscribe('MSFT');
      service.subscribe('GOOGL');

      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
      const subscribedSymbols = service.getSubscribedSymbols();
      expect(subscribedSymbols).toContain('AAPL');
      expect(subscribedSymbols).toContain('MSFT');
      expect(subscribedSymbols).toContain('GOOGL');
    });

    test('should unsubscribe from a symbol', () => {
      service.subscribe('AAPL');
      service.unsubscribe('AAPL');

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'unsubscribe', symbol: 'AAPL' })
      );
      expect(service.getSubscribedSymbols()).not.toContain('AAPL');
    });

    test('should not subscribe if service is not running', () => {
      service.stop();
      service.subscribe('AAPL');

      // Should not attempt to send after stop
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', symbol: 'AAPL' })
      );
    });

    test('should queue subscription if WebSocket is not open', () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;
      
      service.subscribe('TSLA');

      // Should add to subscribed symbols but not send yet
      expect(service.getSubscribedSymbols()).toContain('TSLA');
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;
    });

    test('should handle trade messages and emit market ticks', () => {
      const messageHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const tradeMessage = {
        type: 'trade',
        data: [
          {
            s: 'AAPL',
            p: 150.25,
            v: 100,
            t: 1635782400000,
            c: ['1'],
          },
          {
            s: 'AAPL',
            p: 150.30,
            v: 200,
            t: 1635782401000,
            c: ['1'],
          },
        ],
      };

      messageHandler?.(JSON.stringify(tradeMessage));

      expect(eventBus.emit).toHaveBeenCalledTimes(2);
      expect(eventBus.emit).toHaveBeenCalledWith('market:tick', {
        symbol: 'AAPL',
        price: 150.25,
        volume: 100,
        timestamp: 1635782400000,
      });
      expect(eventBus.emit).toHaveBeenCalledWith('market:tick', {
        symbol: 'AAPL',
        price: 150.30,
        volume: 200,
        timestamp: 1635782401000,
      });
    });

    test('should handle ping messages', () => {
      const messageHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      const pingMessage = {
        type: 'ping',
      };

      messageHandler?.(JSON.stringify(pingMessage));

      // Should not emit any events for ping
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    test('should handle malformed messages gracefully', () => {
      const messageHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )?.[1];

      messageHandler?.('invalid json');

      // Should not crash, just log error
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should attempt to reconnect on disconnect', async () => {
      const closeHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'close'
      )?.[1];

      // Reset mock to track new WebSocket creation
      (WebSocket as unknown as jest.Mock).mockClear();

      // Simulate disconnect
      closeHandler?.(1000, Buffer.from('Normal closure'));

      // Advance timers to trigger reconnect
      jest.advanceTimersByTime(5000);

      // Should create new WebSocket for reconnection
      expect(WebSocket).toHaveBeenCalled();
    });

    test('should resubscribe to symbols after reconnection', async () => {
      service.subscribe('AAPL');
      service.subscribe('MSFT');

      // Reset send mock
      mockWebSocket.send.mockClear();

      const closeHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'close'
      )?.[1];

      // Simulate disconnect
      closeHandler?.(1000, Buffer.from('Normal closure'));

      // Advance timers to trigger reconnect
      jest.advanceTimersByTime(5000);

      // Simulate new connection opening
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();

      // Should resubscribe to both symbols
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', symbol: 'AAPL' })
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', symbol: 'MSFT' })
      );
    });

    test('should emit connection-lost event after max reconnect attempts', async () => {
      const closeHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'close'
      )?.[1];

      // Simulate 5 failed reconnection attempts
      for (let i = 0; i < 5; i++) {
        closeHandler?.(1000, Buffer.from('Connection lost'));
        jest.advanceTimersByTime(5000 * (i + 1));
      }

      // One more disconnect to trigger the max attempts check
      closeHandler?.(1000, Buffer.from('Connection lost'));

      // After max attempts, should emit connection-lost event
      expect(eventBus.emit).toHaveBeenCalledWith('market:connection-lost');
    });
  });

  describe('Ping/Pong Keep-Alive', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should send ping messages periodically', () => {
      mockWebSocket.ping.mockClear();

      // Advance 30 seconds
      jest.advanceTimersByTime(30000);
      expect(mockWebSocket.ping).toHaveBeenCalledTimes(1);

      // Advance another 30 seconds
      jest.advanceTimersByTime(30000);
      expect(mockWebSocket.ping).toHaveBeenCalledTimes(2);
    });

    test('should stop sending pings after service stops', async () => {
      mockWebSocket.ping.mockClear();

      // Advance 30 seconds
      jest.advanceTimersByTime(30000);
      expect(mockWebSocket.ping).toHaveBeenCalledTimes(1);

      await service.stop();

      // Advance another 30 seconds - should not ping
      jest.advanceTimersByTime(30000);
      expect(mockWebSocket.ping).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket errors', async () => {
      const startPromise = service.start();

      // Immediately trigger error before connection is established
      const errorHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      const error = new Error('Connection failed');
      
      // Set readyState to something other than OPEN to ensure rejection
      mockWebSocket.readyState = WebSocket.CONNECTING;
      errorHandler?.(error);

      // If error occurs before connection is established, promise should reject
      await expect(startPromise).rejects.toThrow('Connection failed');
    }, 20000); // Increase timeout for this test

    test('should handle errors after connection is established', async () => {
      const startPromise = service.start();
      const openHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'open'
      )?.[1];
      openHandler?.();
      await startPromise;

      const errorHandler = mockWebSocket.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      const error = new Error('Runtime error');
      
      // Should not throw, just log
      expect(() => errorHandler?.(error)).not.toThrow();
    });
  });
});
