import { Router, Response } from 'express';
import { TestResult } from '../models';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

// POST /api/results — save a test result (auth optional, saved to user if logged in)
router.post('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    wpm, rawWpm, accuracy, consistency,
    charsCorrect, charsWrong, duration,
    charErrors, wpmTimeline,
  } = req.body;

  if (wpm === undefined || accuracy === undefined) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
  }

  try {
    const result = await TestResult.create({
      userId: req.userId ?? null,
      wpm: Number(wpm),
      rawWpm: Number(rawWpm || wpm),
      accuracy: Number(accuracy),
      consistency: Number(consistency || 100),
      charsCorrect: Number(charsCorrect || 0),
      charsWrong: Number(charsWrong || 0),
      duration: Number(duration || 30),
      charErrors: charErrors ?? {},
      wpmTimeline: wpmTimeline ?? [],
    });
    res.status(201).json({ result });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/results/me — get authenticated user's results
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const sort = req.query.sort === 'wpm' ? 'wpm' : 'createdAt';

  try {
    const results = await TestResult.findAll({
      where: { userId: req.userId! },
      order: [[sort, 'DESC']],
      limit,
    });
    res.json({ results });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/results/stats — get aggregate stats for authenticated user
router.get('/stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const results = await TestResult.findAll({
      where: { userId: req.userId! },
      order: [['createdAt', 'DESC']],
    });

    if (results.length === 0) {
      res.json({
        bestWpm: 0,
        avgWpm: 0,
        avg10Wpm: 0,
        bestAccuracy: 0,
        avgAccuracy: 0,
        totalTests: 0,
        totalTimeSeconds: 0,
        totalCharsTyped: 0,
      });
      return;
    }

    const bestWpm = Math.max(...results.map(r => r.wpm));
    const avgWpm = Math.round(results.reduce((s, r) => s + r.wpm, 0) / results.length);
    const last10 = results.slice(0, 10);
    const avg10Wpm = Math.round(last10.reduce((s, r) => s + r.wpm, 0) / last10.length);
    const bestAccuracy = parseFloat(Math.max(...results.map(r => r.accuracy)).toFixed(1));
    const avgAccuracy = parseFloat((results.reduce((s, r) => s + r.accuracy, 0) / results.length).toFixed(1));
    const totalTimeSeconds = results.reduce((s, r) => s + r.duration, 0);
    const totalCharsTyped = results.reduce((s, r) => s + r.charsCorrect + r.charsWrong, 0);

    res.json({
      bestWpm,
      avgWpm,
      avg10Wpm,
      bestAccuracy,
      avgAccuracy,
      totalTests: results.length,
      totalTimeSeconds,
      totalCharsTyped,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
