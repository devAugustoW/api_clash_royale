import express from 'express';
import cors from 'cors';
import './config/database';
import battleRoutes from './routes/battleRoutes';
import cardRoutes from './routes/cardRoutes';
import playerRoutes from './routes/playerRoutes';

const app = express();

// Configuração do CORS
app.use(cors({
  origin: 'http://localhost:5173', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/battles', battleRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/players', playerRoutes);


export default app;