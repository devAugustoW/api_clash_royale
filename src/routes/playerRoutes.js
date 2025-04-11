import { Router } from 'express';
import playerController from '../controllers/playerController';
const router = Router();

router.get('/two', playerController.getTwoPlayers);

export default router;