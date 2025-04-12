import { Router } from 'express';
import battleController from '../controllers/battleController';

const router = Router();

router.get('/first-five', battleController.getFirstFive);
router.get('/list', battleController.getBattleList);
router.get('/stats', battleController.getBattlesStats);

export default router;