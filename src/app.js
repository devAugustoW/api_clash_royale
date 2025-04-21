import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import './config/database';
import battleRoutes from './routes/battleRoutes';
import cardRoutes from './routes/cardRoutes';
import playerRoutes from './routes/playerRoutes';

dotenv.config();
const app = express();

// CORS
app.use(cors({
  origin: process.env.FRONTEND_HOST.split(','),
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/battles', battleRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/players', playerRoutes);


export default app;
