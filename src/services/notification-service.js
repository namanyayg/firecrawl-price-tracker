/**
 * Simple notification service that logs price updates to console
 */
export class NotificationService {
  notifyChanges(updates, newItems) {
    if (newItems.length === 0 && updates.length === 0) return;

    if (newItems.length > 0) {
      console.log('\n🆕 New items tracked:');
      for (const item of newItems) {
        console.log(`${item.title}: ${item.price} ${item.currency}`);
      }
    }
    
    if (updates.length > 0) {
      console.log('\n💰 Price updates:');
      for (const update of updates) {
        console.log(`\n${update.title}:`);
        console.log(`Old: ${update.oldPrice} ${update.currency}`);
        console.log(`New: ${update.newPrice} ${update.currency}`);
        console.log(`Change: ${update.percentChange.toFixed(2)}%`);
      }
    }
    
    console.log(); // Empty line for better readability
  }
} 