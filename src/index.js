/**
 * Firecrawl Price Tracker
 * By Namanyay Goel (@namanyayg)
 * 
 * A price tracker that watches your favorite products and lets you know when prices drop!
 * Uses Firecrawl Extract to get structured data from any product page, and keeps track of price history.
 * 
 * How it works:
 * 1. Stores product URLs in SQLite via Prisma
 * 2. Runs every 12h to check prices using Firecrawl Extract
 * 3. Tracks price changes and notifies via console
 * 
 * Future features:
 * - Crawl and store entire ecommerce store sitemap using Firecrawl Crawl
 * - Add authentication and allow different tracked URLs list per user
 * - Add email/Telegram/discord notifications
 * - Browser app/extension for easy product adding
 */

import { PrismaClient } from '@prisma/client';
import FirecrawlApp from '@mendable/firecrawl-js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { ProductService } from './services/product-service.js';
import { NotificationService } from './services/notification-service.js';

// Load environment variables
dotenv.config();

// Initialize our services
const prisma = new PrismaClient();
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

const productService = new ProductService(prisma, firecrawl);
const notificationService = new NotificationService();

async function checkAndNotifyPrices() {
  const urls = [
    'https://www.zara.com/in/en/geometric-crochet-shirt-p07200330.html?v1=364096376&v2=2439352',
    'https://www2.hm.com/en_in/productpage.1227157004.html'
  ]
  console.log('Checking prices...');
  for (const url of urls) {
    await productService.addUrl(url);
  }
  const { updates, newItems } = await productService.checkPrices();
  console.log(`Found ${updates.length} updates and ${newItems.length} new items`);
  console.log('Notifying changes...');
  notificationService.notifyChanges(updates, newItems);
}

// Run the price check every 12 hours
if (process.env.SHOULD_SCHEDULE === 'true') {
  cron.schedule('0 */12 * * *', checkAndNotifyPrices);
}

// Also run it once on startup
console.log('Starting price tracker...');
checkAndNotifyPrices(); 