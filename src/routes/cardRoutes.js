import { Router } from 'express';
import cardController from '../controllers/cardController';

const router = Router();

router.get('/two', cardController.getTwoCards);

router.get('/popular', cardController.getTopPopularCards);
router.get('/least-popular', cardController.getLeastPopularCards);

router.get('/top-decks', cardController.getTopDecks);
router.get('/stats', cardController.getCardStats);
router.get('/victories-with-less', cardController.victoriesWithLessCrows);
router.get('/combo-loss', cardController.getComboLoss);
router.get('/all', cardController.getAllCards);
router.get('/winning-combo', cardController.getWinningCardCombo);

export default router;