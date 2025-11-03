import { getRecentWinners } from '../lib/winnerListService.js';

export const recentWinners = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    const winners = await getRecentWinners(period);
    res.json({ success: true, winners });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
