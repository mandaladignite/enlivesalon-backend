import express from 'express';

const router = express.Router();

// Placeholder stylist routes
router.get('/', (req, res) => {
    res.json({ message: 'Get stylists endpoint - to be implemented' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create stylist endpoint - to be implemented' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update stylist endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete stylist endpoint - to be implemented' });
});

export default router;
