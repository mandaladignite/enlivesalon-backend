import express from 'express';
import {
  getAllReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
  toggleReviewStatus,
  toggleFeaturedStatus,
  getAdminReviews
} from '../controllers/review.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { validateReview } from '../middleware/validation.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllReviews);
router.get('/:id', getReviewById);

// Admin routes - require authentication
router.use(verifyJWT); // Apply authentication middleware to all routes below

// Admin review management routes
router.post('/', uploadSingle('image'), validateReview, createReview);
router.put('/:id', uploadSingle('image'), validateReview, updateReview);
router.delete('/:id', deleteReview);
router.patch('/:id/toggle-status', toggleReviewStatus);
router.patch('/:id/toggle-featured', toggleFeaturedStatus);

// Admin dashboard route
router.get('/admin/dashboard', getAdminReviews);

export default router;
