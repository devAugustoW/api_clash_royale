import express from 'express';
import './config/database';
import battleRoutes from './routes/battleRoutes';
import cardRoutes from './routes/cardRoutes';
import playerRoutes from './routes/playerRoutes';

const app = express();

app.use(express.json());

app.use('/api/battles', battleRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/players', playerRoutes);


export default app;