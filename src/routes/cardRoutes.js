import { Router } from 'express';
import cardController from '../controllers/cardController';

const router = Router();

router.get('/two', cardController.getTwoCards);

router.get('/popular', cardController.getTopPopularCards);
router.get('/least-popular', cardController.getLeastPopularCards);

router.get('/stats', cardController.getCardStats);
router.get('/top-decks', cardController.getTopDecks);
router.get('/combo-loss', cardController.getComboLoss);
router.get('/victories-with-less', cardController.victoriesWithLessCrows);
router.get('/winning-combo', cardController.getWinningCardCombo);
router.get('/all', cardController.getAllCards);


export default router;