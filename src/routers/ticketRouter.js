import { Router } from "express";
import {
  listTickets,
  getTicketById,
  addTicket,
  updateTicket,
  deleteTicket
} from "../controllers/ticketController.js";
import { upload } from "../middleware/imageMulterMiddleware.js";
import { authMiddleware } from "../middleware/authUserMiddleware.js";

const router = Router();

const allowedRoles = ['content-creator', 'superadmin', 'admin'];

router.get('/', listTickets);
router.get('/:id', getTicketById);

router.post(
  '/',
  authMiddleware(allowedRoles),
  upload.single('image'), // single image file upload
  addTicket
);

router.put(
  '/:id',
  authMiddleware(allowedRoles),
  upload.single('image'),
  updateTicket
);

router.delete('/:id', authMiddleware(allowedRoles), deleteTicket);

export default router;
