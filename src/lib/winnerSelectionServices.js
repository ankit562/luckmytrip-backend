import MultiTicketPurchase from '../models/addtocartModel.js';
import { Client } from '../models/authUserModel.js';

// Weighted random selection helper
export function pickWeightedWinner(users) {
  const totalWeight = users.reduce((sum, u) => sum + u.chance, 0);
  let random = Math.random() * totalWeight;

  for (const userObj of users) {
    random -= userObj.chance;
    if (random <= 0) {
      return userObj;
    }
  }
  return users[users.length - 1]; // fallback
}

// Calculate user chance limited to purchases of a given ticketId and general rules
export async function calculateUserChanceForTicket(user, ticketId) {
  // Find all confirmed purchases for this user
  const allPurchases = await MultiTicketPurchase.find({
    user: user._id,
    status: 'confirmed',
  });

  // Filter purchases that contain this specific ticket
  const purchases = allPurchases.filter(purchase => {
    return purchase.tickets.some(t => t.ticket === ticketId);
  });

  let totalTickets = 0;
  const eventNamesSet = new Set();

  for (const purchase of purchases) {
    for (const t of purchase.tickets) {
      if (t.ticket === ticketId) {
        totalTickets += t.quantity;
        eventNamesSet.add(t.ticket);
      }
      // Also add all other ticket types to eventNamesSet for condition 3
      eventNamesSet.add(t.ticket);
    }
  }

  // Apply your conditions
  let chance = 5; // default fallback chance
  let winningCondition = 5;

  // Example conditions based on your original rules:
  if (purchases.length === 1) {
    chance = 20;
    winningCondition = 1;
  }

  // Condition: bought 3+ tickets same event (here we consider ticket quantity only)
  if (totalTickets >= 3) {
    if (chance < 30) {
      chance = 30;
      winningCondition = 2;
    }
  }

  // Condition: active buyer across at least 3 events (simplified here as >= 3 different tickets)
  if (eventNamesSet.size >= 3) {
    if (chance < 40) {
      chance = 40;
      winningCondition = 3;
    }
  }

  // Condition: bought 10+ tickets total for this event, excluding those who last won by 4
  if (totalTickets >= 10 && user.lastWinCondition !== 4) {
    chance = 60;
    winningCondition = 4;
  }

  return { chance, winningCondition };
}

// Select and record winner for a specific ticket/event
export async function selectAndRecordWinnerForTicket(ticketId) {
  try {
    console.log('Selecting winner for ticketId:', ticketId);
    
    // Find all confirmed purchases that contain this ticket
    const allPurchases = await MultiTicketPurchase.find({ status: 'confirmed' });
    
    // Filter purchases that have this specific ticket
    const purchases = allPurchases.filter(purchase => {
      return purchase.tickets.some(t => t.ticket === ticketId);
    });

    console.log(`Found ${purchases.length} purchases with ticket ${ticketId}`);

    if (purchases.length === 0) {
      console.log('No purchases found for this ticket');
      return null;
    }

    const userMap = new Map();

    // Aggregate users and ticket quantities for this ticket
    for (const purchase of purchases) {
      const userIdStr = purchase.user.toString();
      if (!userMap.has(userIdStr)) {
        userMap.set(userIdStr, { userId: purchase.user, ticketQuantity: 0 });
      }
      for (const t of purchase.tickets) {
        if (t.ticket === ticketId) {
          userMap.get(userIdStr).ticketQuantity += t.quantity;
        }
      }
    }

    console.log(`Found ${userMap.size} unique users who purchased this ticket`);

    const userChances = [];

    for (const { userId } of userMap.values()) {
      const user = await Client.findById(userId);
      if (!user) {
        console.log(`User ${userId} not found`);
        continue;
      }

      const { chance, winningCondition } = await calculateUserChanceForTicket(user, ticketId);
      console.log(`User ${user.fullName}: chance=${chance}, condition=${winningCondition}`);

      userChances.push({ user, chance, winningCondition });
    }

    if (userChances.length === 0) {
      console.log('No eligible users found');
      return null;
    }

    // Pick weighted winner
    const winner = pickWeightedWinner(userChances);
    console.log(`Winner selected: ${winner.user.fullName} with condition ${winner.winningCondition}`);

    // Update winner data
    await Client.findByIdAndUpdate(winner.user._id, {
      lastWinCondition: winner.winningCondition,
      $push: { winHistory: { condition: winner.winningCondition, date: new Date() } },
      $inc: { won: 1 },
    });

    return winner;
  } catch (error) {
    console.error('Error in selectAndRecordWinnerForTicket:', error);
    throw error;
  }
}
