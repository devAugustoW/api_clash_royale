import { Router } from 'express';
import battleController from '../controllers/battleController';

const router = Router();

router.get('/first-one', battleController.getFirstOne);
router.get('/stats', battleController.getBattlesStats);
router.get('/list', battleController.getBattleList);


export default router;