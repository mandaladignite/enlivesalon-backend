import express from 'express';

const router = express.Router();

// Placeholder service routes
router.get('/', (req, res) => {
    res.json({ message: 'Get services endpoint - to be implemented' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create service endpoint - to be implemented' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update service endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete service endpoint - to be implemented' });
});

export default router;
