import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize } from './models';
import authRouter from './routes/auth';
import resultsRouter from './routes/results';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/results', resultsRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({ 
    message: 'TypeTester API', 
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      results: '/api/results'
    }
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  TypeTester API running on port :- ${PORT}`);
    console.log(`  Health: /api/health\n`);
  });
}).catch((err: unknown) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
