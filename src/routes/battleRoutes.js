import { Router } from 'express';
import battleController from '../controllers/battleController';

const router = Router();

router.get('/first-one', battleController.getFirstOne);
router.get('/list', battleController.getBattleList);
router.get('/stats', battleController.getBattlesStats);

export default router;