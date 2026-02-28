import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize } from './models';
import authRouter from './routes/auth';
import resultsRouter from './routes/results';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

// Middleware
const corsOptions = {
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      'https://type-tester-client.vercel.app',
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(null, true); // Allow anyway to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests
app.options('*', cors(corsOptions));

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
