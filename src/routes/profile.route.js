import express from 'express';

const router = express.Router();

// Placeholder profile routes
router.get('/', (req, res) => {
    res.json({ message: 'Get profile endpoint - to be implemented' });
});

router.put('/', (req, res) => {
    res.json({ message: 'Update profile endpoint - to be implemented' });
});

export default router;
