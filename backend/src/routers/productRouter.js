import { Router } from "express";
import { 
  listProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";
import { upload } from "../middleware/imageMulterMiddleware.js";
import { authMiddleware } from "../middleware/authUserMiddleware.js";

const router = Router();

const allowedRoles = ['content-creator', 'superadmin', 'admin'];

router.get('/', listProducts);
router.get('/:id', getProductById);

// Use upload.fields for multiple images like image, image2
router.post(
  '/',
  authMiddleware(allowedRoles),
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
  ]),
  addProduct
);

router.put(
  '/:id',
  authMiddleware(allowedRoles),
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
  ]),
  updateProduct
);

router.delete('/:id', authMiddleware(allowedRoles), deleteProduct);

export default router;
