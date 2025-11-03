import mongoose from 'mongoose';
import { Client } from '../models/authUserModel.js';

export async function getRecentWinners(period, limit = 5) {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      startDate = new Date(now.getFullYear(), now.getMonth(), diff);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      throw new Error('Invalid period');
  }

  const pipeline = [
    { $unwind: '$winHistory' },
    { $match: { 'winHistory.date': { $gte: startDate } } },
    {
      $group: {
        _id: '$_id',
        fullName: { $first: '$fullName' },
        winCount: { $sum: 1 },
        lastWinDate: { $max: '$winHistory.date' },
      }
    },
    { $sort: { lastWinDate: -1, winCount: -1 } },
    { $limit: limit }
  ];

  const winners = await Client.aggregate(pipeline);
  return winners;
}
