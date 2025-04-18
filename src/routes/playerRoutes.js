import { Router } from 'express';
import playerController from '../controllers/playerController';
const router = Router();

router.get('/two', playerController.getTwoPlayers);

router.get('/stats', playerController.getPlayerStats);
router.get('/:tag', playerController.getPlayerByTag);

export default router;