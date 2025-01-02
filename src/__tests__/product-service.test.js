import { PrismaClient } from '@prisma/client';
import FirecrawlApp from '@mendable/firecrawl-js';
import { ProductService } from '../services/product-service.js';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});
const productService = new ProductService(prisma, firecrawl);

// Test URLs from different retailers
const TEST_URLS = {
  zara: 'https://www.zara.com/in/en/geometric-crochet-shirt-p07200330.html?v1=364096376&v2=2439352',
  hm: 'https://www2.hm.com/en_in/productpage.1227157004.html'
};

// Mock Firecrawl responses
const mockProducts = {
  zara: [
    { title: 'Geometric Crochet Shirt', price: 2999, currency: 'INR' },
    { title: 'Geometric Crochet Shirt', price: 2499, currency: 'INR' }, // Price drop
    { title: 'Geometric Crochet Shirt', price: 3499, currency: 'INR' }, // Price increase
  ],
  hm: [
    { title: 'Cotton T-shirt', price: 1499, currency: 'INR' },
    { title: 'Cotton T-shirt', price: 1499, currency: 'INR' }, // No change
    { title: 'Cotton T-shirt', price: 999, currency: 'INR' },  // Price drop
  ]
};

let currentScrapeIndex = 0;

describe('ProductService', () => {
  beforeAll(async () => {
    // Mock Firecrawl scrapeUrl to return different prices each time
    firecrawl.scrapeUrl = jest.fn().mockImplementation((url) => {
      const product = url.includes('zara.com') 
        ? mockProducts.zara[currentScrapeIndex] 
        : mockProducts.hm[currentScrapeIndex];
      
      return Promise.resolve({
        success: true,
        extract: {
          ...product,
          availability: true,
          brand: url.includes('zara.com') ? 'Zara' : 'H&M',
          description: 'Mock product description'
        }
      });
    });

    // Clean up database
    await prisma.price.deleteMany();
    await prisma.trackedUrl.deleteMany();
  });

  afterAll(async () => {
    await prisma.price.deleteMany();
    await prisma.trackedUrl.deleteMany();
    await prisma.$disconnect();
  });

  describe('addUrl', () => {
    it('should add a Zara URL and fetch initial price', async () => {
      const trackedUrl = await productService.addUrl(TEST_URLS.zara);
      expect(trackedUrl).toBeDefined();
      expect(trackedUrl.url).toBe(TEST_URLS.zara);

      const prices = await prisma.price.findMany({
        where: { trackedUrlId: trackedUrl.id }
      });
      expect(prices).toHaveLength(1);
      expect(prices[0].price).toBeGreaterThan(0);
      expect(prices[0].title).toBeDefined();
    }, 30000);

    it('should add an H&M URL and fetch initial price', async () => {
      const trackedUrl = await productService.addUrl(TEST_URLS.hm);
      expect(trackedUrl).toBeDefined();
      expect(trackedUrl.url).toBe(TEST_URLS.hm);

      const prices = await prisma.price.findMany({
        where: { trackedUrlId: trackedUrl.id }
      });
      expect(prices).toHaveLength(1);
      expect(prices[0].price).toBeGreaterThan(0);
      expect(prices[0].title).toBeDefined();
    }, 30000);
  });

  describe('listUrls', () => {
    it('should list all tracked URLs with their latest prices', async () => {
      const urls = await productService.listUrls();
      expect(urls).toHaveLength(2); // We added 2 URLs above
      
      for (const url of urls) {
        expect(url.prices).toHaveLength(1);
        expect(url.prices[0].price).toBeGreaterThan(0);
      }
    });
  });

  describe('checkPrices', () => {
    it('should check prices for all tracked URLs', async () => {
      const { updates, newItems } = await productService.checkPrices();
      expect(Array.isArray(updates)).toBe(true);
      expect(Array.isArray(newItems)).toBe(true);
      
      // Updates might exist if prices changed since our last check
      if (updates.length > 0) {
        for (const update of updates) {
          expect(update.title).toBeDefined();
          expect(update.oldPrice).toBeGreaterThan(0);
          expect(update.newPrice).toBeGreaterThan(0);
          expect(update.percentChange).toBeDefined();
        }
      }
    }, 30000);
  });

  describe('price tracking over time', () => {
    it('should detect price changes across multiple checks', async () => {
      // Add initial URLs
      console.log('\n=== Initial URL Addition ===');
      const zaraUrl = await productService.addUrl(TEST_URLS.zara);
      const hmUrl = await productService.addUrl(TEST_URLS.hm);
      console.log('Added Zara URL:', TEST_URLS.zara);
      console.log('Added H&M URL:', TEST_URLS.hm);

      // First price check (same as initial prices)
      currentScrapeIndex = 0;
      console.log('\n=== First Price Check ===');
      let result = await productService.checkPrices();
      console.log('New Items:');
      result.newItems.forEach(item => {
        console.log(`- ${item.title}: ${item.price} ${item.currency}`);
      });
      console.log('Price Updates: None (initial check)');

      // Second price check (Zara price drops, H&M stays same)
      currentScrapeIndex = 1;
      console.log('\n=== Second Price Check ===');
      result = await productService.checkPrices();
      console.log('Price Updates:');
      result.updates.forEach(update => {
        console.log(
          `- ${update.title}:\n` +
          `  Old Price: ${update.oldPrice} ${update.currency}\n` +
          `  New Price: ${update.newPrice} ${update.currency}\n` +
          `  Change: ${update.percentChange.toFixed(2)}%`
        );
      });

      // Third price check (Zara price increases, H&M price drops)
      currentScrapeIndex = 2;
      console.log('\n=== Third Price Check ===');
      result = await productService.checkPrices();
      console.log('Price Updates:');
      result.updates.forEach(update => {
        console.log(
          `- ${update.title}:\n` +
          `  Old Price: ${update.oldPrice} ${update.currency}\n` +
          `  New Price: ${update.newPrice} ${update.currency}\n` +
          `  Change: ${update.percentChange.toFixed(2)}%`
        );
      });

      // ... rest of the test assertions ...
    }, 30000);
  });
}); 