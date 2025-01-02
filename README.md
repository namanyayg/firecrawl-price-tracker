# Firecrawl Price Tracker
By Namanyay Goel (@namanyayg)

A price tracker that watches your favorite products and lets you know when prices drop!
Uses Firecrawl Extract to get structured data from any product page, and keeps track of price history.

## How it works

1. Stores product URLs in SQLite via Prisma
2. Runs every 12h to check prices using Firecrawl Extract
3. Tracks price changes and notifies via console

## Future features

- Crawl and store entire ecommerce store sitemap using Firecrawl Crawl
- Add authentication and allow different tracked URLs list per user
- Add email/Telegram/discord notifications
- Browser app/extension for easy product adding and viewing

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your API keys:
   - `FIRECRAWL_API_KEY`: Get from [Firecrawl](https://firecrawl.dev)

4. Initialize the database:
   ```bash
   npm run db:push
   ```

## Usage

1. Start the tracker:
   ```bash
   npm start
   ```

2. (Optional) Add URLs to track using Prisma Studio:
   ```bash
   npm run db:studio
   ```
   Then add entries to the `TrackedUrl` table.
