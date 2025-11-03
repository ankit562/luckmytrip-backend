import cron from 'node-cron';
import Ticket from '../models/ticketModel.js';
import { selectAndRecordWinnerForTicket } from '../lib/winnerSelectionServices.js';

cron.schedule('0 0 * * *', async () => {  // Runs daily at midnight
  try {
    const today = new Date();
    // Find sold-out tickets with past or current draw date
    const soldOutTickets = await Ticket.find({
      $expr: { $gte: ['$ticketsSold', '$totalTickets'] },
      date: { $lte: today },
      status: 'publish',
    });
    // Run winner selection for each eligible ticket
    for (const ticket of soldOutTickets) {
      const winner = await selectAndRecordWinnerForTicket(ticket._id);
      console.log(`Winner for ${ticket.name}: ${winner?.user?.fullName || 'none'}`);
    }
  } catch (error) {
    console.error('Scheduled winner draw error:', error);
  }
});
