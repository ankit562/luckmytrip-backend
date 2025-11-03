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
  // Find all purchases for this user filtered to the specific ticket
  const purchases = await MultiTicketPurchase.find({
    user: user._id,
    'tickets.ticket': ticketId,
    status: 'confirmed',
  });

  let totalTickets = 0;
  const eventNamesSet = new Set();

  for (const purchase of purchases) {
    for (const t of purchase.tickets) {
      if (t.ticket.toString() === ticketId.toString()) {
        totalTickets += t.quantity;
        eventNamesSet.add(t.ticket);
      }
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
  // Find users who bought this ticket
  const purchases = await MultiTicketPurchase.find({ 'tickets.ticket': ticketId, status: 'confirmed' });

  const userMap = new Map();

  // Aggregate users and ticket quantities for this ticket
  for (const purchase of purchases) {
    const userIdStr = purchase.user.toString();
    if (!userMap.has(userIdStr)) userMap.set(userIdStr, { userId: purchase.user, ticketQuantity: 0 });
    for (const t of purchase.tickets) {
      if (t.ticket.toString() === ticketId.toString()) {
        userMap.get(userIdStr).ticketQuantity += t.quantity;
      }
    }
  }

  const userChances = [];

  for (const { userId } of userMap.values()) {
    const user = await Client.findById(userId);
    if (!user) continue;

    const { chance, winningCondition } = await calculateUserChanceForTicket(user, ticketId);

    userChances.push({ user, chance, winningCondition });
  }

  if (userChances.length === 0) return null;

  // Pick weighted winner
  const winner = pickWeightedWinner(userChances);

  // Update winner data
  await Client.findByIdAndUpdate(winner.user._id, {
    lastWinCondition: winner.winningCondition,
    $push: { winHistory: { condition: winner.winningCondition, date: new Date() } },
    $inc: { won: 1 },
  });

  return winner;
}
