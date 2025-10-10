import express from 'express';

const router = express.Router();

// Placeholder package routes
router.get('/', (req, res) => {
    res.json({ message: 'Get packages endpoint - to be implemented' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create package endpoint - to be implemented' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update package endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete package endpoint - to be implemented' });
});

export default router;
