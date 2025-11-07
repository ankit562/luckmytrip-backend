import cron from 'node-cron';
import Ticket from '../models/ticketModel.js';
import { selectAndRecordWinnerForTicket } from '../lib/winnerSelectionServices.js';

// Run daily at midnight to check for tickets with draw dates that have passed
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running scheduled winner draw check...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find tickets with draw date today or earlier, and status is still 'publish' (not archived)
    const dueTickets = await Ticket.find({
      date: { $lte: today },
      status: 'publish',
    });

    console.log(`Found ${dueTickets.length} tickets with draw date due`);

    // Run winner selection for each eligible ticket
    for (const ticket of dueTickets) {
      try {
        // Convert ticket name to purchase key format (e.g., "Dubai" -> "DUBAI_TICKET")
        const purchaseKey = `${ticket.name.toUpperCase().replace(/\s+/g, '_')}_TICKET`;
        
        console.log(`Running draw for ${ticket.name} (${purchaseKey})...`);
        const winner = await selectAndRecordWinnerForTicket(purchaseKey);
        
        if (winner) {
          console.log(`✅ Winner for ${ticket.name}: ${winner.user?.fullName || winner.user?.email || 'Unknown'}`);
          
          // Archive the ticket after draw
          ticket.status = 'archived';
          await ticket.save();
          console.log(`✅ Ticket ${ticket.name} archived`);
        } else {
          console.log(`⚠️ No winner found for ${ticket.name} - no eligible purchases`);
        }
      } catch (ticketError) {
        console.error(`Error processing ticket ${ticket.name}:`, ticketError);
      }
    }
    
    console.log('Scheduled winner draw check completed');
  } catch (error) {
    console.error('Scheduled winner draw error:', error);
  }
});
