import express from 'express';

import battleRoutes from './routes/battleRoutes';
import cardRoutes from './routes/cardRoutes';
import playerRoutes from './routes/playerRoutes';

const app = express();

app.use(express.json());

//app.use('/api/battles', battleRoutes);
//app.use('/api/cards', cardRoutes);
//app.use('/api/players', playerRoutes);

app.get('/', (req, res) => {
  res.send('API Clash Royale funcionando!');
});

export default app;