import express from 'express';
import cors from 'cors';
import apiHandler from './api/price.js';

const app = express();
app.use(cors());

// Vercel like wrapper
app.get('/api/price', async (req, res) => {
    // mock vercel req/res handler
    try {
        await apiHandler(req, res);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Local API Dev Server running on http://localhost:${PORT}`);
});
