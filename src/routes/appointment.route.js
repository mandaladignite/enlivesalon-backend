import express from 'express';

const router = express.Router();

// Placeholder appointment routes
router.get('/', (req, res) => {
    res.json({ message: 'Get appointments endpoint - to be implemented' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create appointment endpoint - to be implemented' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update appointment endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete appointment endpoint - to be implemented' });
});

export default router;
