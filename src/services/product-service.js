import { z } from 'zod';

// Schema for what we want to extract from product pages
export const productSchema = z.object({
  title: z.string(),
  price: z.number(),
  currency: z.string().optional(),
  availability: z.boolean().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
});

export class ProductService {
  constructor(prisma, firecrawl) {
    this.prisma = prisma;
    this.firecrawl = firecrawl;
  }

  async addUrl(url) {
    try {
      // First verify we can scrape this URL
      const result = await this.firecrawl.scrapeUrl(url, {
        formats: ['extract'],
        extract: { schema: productSchema },
      });

      if (!result.success) {
        throw new Error(`Failed to scrape URL: ${result.error}`);
      }

      // Add URL to database
      const trackedUrl = await this.prisma.trackedUrl.create({
        data: { url },
      });

      console.log(`Added URL ${url} to database`);

      // Add initial price
      const productData = result.extract;
      await this.prisma.price.create({
        data: {
          trackedUrlId: trackedUrl.id,
          title: productData.title,
          price: productData.price,
          currency: productData.currency || 'USD',
          isAvailable: productData.availability ?? true,
          metadata: JSON.stringify({
            brand: productData.brand,
            description: productData.description,
          }),
        },
      });

      return trackedUrl;
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`URL ${url} is already being tracked`);
      }
    }
  }

  async removeUrl(url) {
    const trackedUrl = await this.prisma.trackedUrl.delete({
      where: { url },
    });
    return trackedUrl;
  }

  async listUrls() {
    return this.prisma.trackedUrl.findMany({
      include: {
        prices: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });
  }

  async checkPrices() {
    const trackedUrls = await this.listUrls();
    console.log(`Checking ${trackedUrls.length} URLs...`);
    const updates = [];
    const newItems = [];
    
    for (const tracked of trackedUrls) {
      try {
        const result = await this.firecrawl.scrapeUrl(tracked.url, {
          formats: ['extract'],
          extract: { schema: productSchema },
        });

        if (!result.success) {
          console.error(`Failed to scrape ${tracked.url}: ${result.error}`);
          continue;
        }

        const productData = result.extract;
        const lastPrice = tracked.prices[0];
        
        // Store the new price
        await this.prisma.price.create({
          data: {
            trackedUrlId: tracked.id,
            title: productData.title,
            price: productData.price,
            currency: productData.currency || 'USD',
            isAvailable: productData.availability ?? true,
            metadata: JSON.stringify({
              brand: productData.brand,
              description: productData.description,
            }),
          },
        });

        // If only 1 last price,it's a new item
        if (tracked.prices.length === 1) {
          newItems.push({
            title: productData.title,
            price: productData.price,
            currency: productData.currency || 'USD',
          });
          continue;
        }

        // Check if price changed
        if (lastPrice.price !== productData.price) {
          const priceDiff = ((productData.price - lastPrice.price) / lastPrice.price) * 100;
          updates.push({
            title: productData.title,
            oldPrice: lastPrice.price,
            newPrice: productData.price,
            percentChange: priceDiff,
            currency: productData.currency || 'USD',
          });
        }
      } catch (error) {
        console.error(`Error processing ${tracked.url}:`, error);
      }
    }

    return { updates, newItems };
  }
} 