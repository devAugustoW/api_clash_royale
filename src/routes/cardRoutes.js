import { Router } from 'express';
import cardController from '../controllers/cardController';

const router = Router();

router.get('/two', cardController.getTwoCards);
router.get('/popular', cardController.getTopPopularCards);
router.get('/least-popular', cardController.getLeastPopularCards);
router.get('/stats', cardController.getCardStatsOptimized);

export default router;