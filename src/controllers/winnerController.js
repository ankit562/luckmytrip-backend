import { selectAndRecordWinnerForTicket } from "../lib/winnerSelectionServices.js";

export const drawWinner = async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ message: "Ticket ID is required" });

    const winner = await selectAndRecordWinnerForTicket(ticketId);

    if (!winner) {
      return res.status(404).json({ message: "No eligible winner found for this ticket" });
    }

    res.json({
      message: 'Winner selected successfully',
      winner: {
        userId: winner.user._id,
        fullName: winner.user.fullName,
        winningCondition: winner.winningCondition,
        chance: winner.chance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to select winner', error: error.message });
  }
};
