import { Router } from 'express';
import cardController from '../controllers/cardController';

const router = Router();

router.get('/two', cardController.getTwoCards);
router.get('/popular', cardController.getTopPopularCards);

export default router;