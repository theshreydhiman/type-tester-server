import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

function signToken(userId: number): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ message: 'All fields are required' });
    return;
  }
  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ message: 'Username must be 3–20 characters' });
    return;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    res.status(400).json({ message: 'Username can only contain letters, numbers, underscores' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: 'Password must be at least 6 characters' });
    return;
  }

  try {
    const existingEmail = User.findOne({ where: { email } });
    if (existingEmail) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }
    const existingUsername = User.findOne({ where: { username } });
    if (existingUsername) {
      res.status(409).json({ message: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = User.create({ email, username, passwordHash });

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username, abusiveConsent: !!user.abusiveConsent },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = User.findOne({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, abusiveConsent: !!user.abusiveConsent },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    const user = User.findByPk(req.userId!);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        abusiveConsent: !!user.abusiveConsent,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/abusive-consent
router.post('/abusive-consent', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    User.updateConsent(req.userId!, true);
    res.json({ abusiveConsent: true });
  } catch (err) {
    console.error('Consent error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
