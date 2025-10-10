import express from 'express';

const router = express.Router();

// Placeholder enquiry routes
router.get('/', (req, res) => {
    res.json({ message: 'Get enquiries endpoint - to be implemented' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create enquiry endpoint - to be implemented' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update enquiry endpoint - to be implemented' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete enquiry endpoint - to be implemented' });
});

export default router;
