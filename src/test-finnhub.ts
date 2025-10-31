import { MarketDataService } from './services/MarketDataService';import { MarketDataService } from './services/MarketDataService';

import { config } from './config';import { config } from './config';

import { eventBus } from './utils/eventBus';import { eventBus } from './utils/eventBus';

import { MarketTick } from './types';import { MarketTick } from './types';



/**/**

 * Simple demo script to test Finnhub WebSocket connection * Simple demo script to test Finnhub WebSocket connection

 */ */

async function testFinnhubConnection() {async function testFinnhubConnection() {

  console.log('============================================');  console.log('============================================');

  console.log('Testing Finnhub WebSocket Connection');  console.log('Testing Finnhub WebSocket Connection');

  console.log('============================================\n');  console.log('============================================\n');



  // Create market data service  // Create market data service

  const marketDataService = new MarketDataService(  const marketDataService = new MarketDataService(

    config.finnhub.apiKey,    config.finnhub.apiKey,

    config.finnhub.wsUrl    config.finnhub.wsUrl

  );  );



  // Listen for market ticks  // Listen for market ticks

  let tickCount = 0;  let tickCount = 0;

  eventBus.on('market:tick', (tick: MarketTick) => {  eventBus.on('market:tick', (tick: MarketTick) => {

    tickCount++;    tickCount++;

    const tickInfo = {    console.log(`\n[TICK #${tickCount}]`, {

      symbol: tick.symbol,      symbol: tick.symbol,

      price: tick.price.toFixed(2),      price: `$${tick.price.toFixed(2)}`,

      volume: tick.volume,      volume: tick.volume,

      time: new Date(tick.timestamp).toLocaleTimeString(),      time: new Date(tick.timestamp).toLocaleTimeString(),

    };    });

    console.log('TICK ' + tickCount, tickInfo);  });

  });

  // Listen for connection lost

  // Listen for connection lost  eventBus.on('market:connection-lost', () => {

  eventBus.on('market:connection-lost', () => {    console.error('\n❌ Connection lost - max reconnect attempts reached');

    console.error('Connection lost - max reconnect attempts reached');  });

  });

  try {

  try {    // Start service

    // Start service    console.log('🚀 Starting market data service...\n');

    console.log('Starting market data service...\n');    await marketDataService.start();

    await marketDataService.start();    console.log('✅ Service started successfully!\n');

    console.log('Service started successfully!\n');

    // Subscribe to some popular stocks

    // Subscribe to some popular stocks    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];

    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];    console.log(`📡 Subscribing to symbols: ${symbols.join(', ')}\n');

    console.log('Subscribing to symbols:', symbols.join(', '));    

    console.log('');    symbols.forEach(symbol => {

          marketDataService.subscribe(symbol);

    symbols.forEach(symbol => {    });

      marketDataService.subscribe(symbol);

    });    console.log('✅ Subscriptions active!');

    console.log('📊 Waiting for market data... (Press Ctrl+C to stop)\n');

    console.log('Subscriptions active!');    console.log('============================================\n');

    console.log('Waiting for market data... (Press Ctrl+C to stop)');

    console.log('');    // Keep running for 60 seconds to collect data

    console.log('============================================\n');    setTimeout(async () => {

      console.log('\n============================================');

    // Keep running for 60 seconds to collect data      console.log(`\nReceived ${tickCount} market ticks in 60 seconds`);

    setTimeout(async () => {      console.log('\nStopping service...');

      console.log('\n============================================');      

      console.log('Received ' + tickCount + ' market ticks in 60 seconds');      await marketDataService.stop();

      console.log('\nStopping service...');      console.log('Service stopped successfully!');

            console.log('\n============================================');

      await marketDataService.stop();      process.exit(0);

      console.log('Service stopped successfully!');    }, 60000);

      console.log('\n============================================');

      process.exit(0);  } catch (error) {

    }, 60000);    console.error('\n❌ Error:', error);

    await marketDataService.stop();

  } catch (error) {    process.exit(1);

    console.error('\nError:', error);  }

    await marketDataService.stop();}

    process.exit(1);

  }// Handle graceful shutdown

}process.on('SIGINT', async () => {

  console.log('\n\n🛑 Shutting down...');

// Handle graceful shutdown  process.exit(0);

process.on('SIGINT', async () => {});

  console.log('\n\nShutting down...');

  process.exit(0);// Run the test

});testFinnhubConnection();


// Run the test
testFinnhubConnection();
