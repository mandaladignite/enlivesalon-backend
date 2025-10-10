import express from 'express';

const router = express.Router();

// Placeholder gallery routes
router.get('/', (req, res) => {
    res.json({ message: 'Get gallery endpoint - to be implemented' });
});

router.post('/upload', (req, res) => {
    res.json({ message: 'Upload gallery image endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete gallery image endpoint - to be implemented' });
});

export default router;
