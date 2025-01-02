import { PrismaClient } from '@prisma/client';
import FirecrawlApp from '@mendable/firecrawl-js';
import { ProductService } from '../services/product-service.js';
import dotenv from 'dotenv';

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

describe('ProductService', () => {
  beforeAll(async () => {
    // Clean up database before tests
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
      
      // Since we just added these items, they shouldn't show up as new
      expect(newItems).toHaveLength(0);
      
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
}); 