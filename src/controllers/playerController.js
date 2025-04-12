import mongoose from 'mongoose';

const playerController = {
	// estudo de caso
  async getTwoPlayers(req, res) {
    try {
      const players = await mongoose.connection.db
        .collection('players')
        .find({})
        .limit(1)
        .toArray();
      
      if (players.length === 0) {
        return res.status(404).json({ message: 'Nenhum jogador encontrado' });
      }
      
      return res.json({
        count: players.length,
        players
      });
    } catch (error) {
      console.error('Erro ao buscar jogadores:', error);
      return res.status(500).json({ error: 'Erro ao buscar jogadores', details: error.message });
    }
  }
};

export default playerController;