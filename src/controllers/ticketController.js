import Ticket from '../models/ticketModel.js';
import { body, validationResult } from 'express-validator';
import { uploadOnCloudinary } from '../lib/cloudinary.js';
import { selectAndRecordWinnerForTicket } from '../lib/winnerSelectionServices.js';
export const ticketValidationRules = () => [
  body('name').notEmpty().withMessage('Name is required').isLength({ min: 2 }),
  body('price').notEmpty().withMessage('Price is required').isFloat({ min: 0 }),
  body('category').notEmpty().withMessage('Category is required').isIn(['event', 'offer']),
  body('ticket').notEmpty().withMessage('Ticket is required').isFloat({ min: 0 }),
  body('date').notEmpty().withMessage('Date is required').isISO8601().toDate(),
  body('description').notEmpty().withMessage('Description is required').isLength({ min: 10 }),
];

export const listTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};


export const getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const addTicket = async (req, res) => {
  await Promise.all(ticketValidationRules().map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const uploadedFile = req.file; // Multer single file uploaded as req.file

    if (!uploadedFile) return res.status(400).json({ error: 'Image file is required' });

    const imageLocalPath = uploadedFile.path;

    const image = await uploadOnCloudinary(imageLocalPath);
    if (!image) return res.status(500).json({ error: 'Image upload failed' });

    const ticketData = {
      ...req.body,
      image: image.secure_url
    };

    const ticket = new Ticket(ticketData);
    await ticket.save();

    res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (error) {
    error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateTicket = async (req, res) => {
  await Promise.all(ticketValidationRules().map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const imageLocalPath = req.file?.image?.[0]?.path;
    const updateData = { ...req.body };
    console.log("req.file:", req.file);
    console.log("req.body:", req.body);
    if (req.file) {
      const uploadedImage = await uploadOnCloudinary(req.file.path);
      if (!uploadedImage || !uploadedImage.secure_url) {
        return res.status(500).json({ error: "Image upload failed" });
      }
      updateData.image = uploadedImage.secure_url;
    }

    if (imageLocalPath) {
      const image = await uploadOnCloudinary(imageLocalPath);
      if (!image) return res.status(500).json({ error: 'Image upload failed' });
      updateData.image = image.secure_url;
    }

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    res.json({ message: 'Ticket updated successfully', ticket });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

// Run draw for a ticket by human-readable name and archive it
export const runDrawByName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const ticketDoc = await Ticket.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (!ticketDoc) return res.status(404).json({ error: 'Ticket not found' });

    const purchaseKey = `${name.toUpperCase().replace(/\s+/g, '_')}_TICKET`;

    const winner = await selectAndRecordWinnerForTicket(purchaseKey);

    // Archive the ticket after draw
    ticketDoc.status = 'archived';
    await ticketDoc.save();

    res.json({ message: 'Draw completed', winner });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};