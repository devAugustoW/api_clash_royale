import { Router } from 'express';
import battleController from '../controllers/battleController';

const router = Router();


router.get('/first-five', battleController.getFirstFive);

export default router;