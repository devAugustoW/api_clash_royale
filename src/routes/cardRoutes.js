import { Router } from 'express';

const router = Router();

// Por enquanto, apenas uma rota básica
router.get('/', (req, res) => {
  res.json({ message: 'Rota de cards' });
});

export default router;