import mongoose from 'mongoose';

const cardController = {
  async getTwoCards(req, res) {
    try {
      const cards = await mongoose.connection.db
        .collection('cards')
        .find({})
        .limit(2)
        .toArray();
      
      if (cards.length === 0) {
        return res.status(404).json({ message: 'Nenhum card encontrado' });
      }
      
      return res.json({
        count: cards.length,
        cards
      });
    } catch (error) {
      console.error('Erro ao buscar cards:', error);
      return res.status(500).json({ error: 'Erro ao buscar cards', details: error.message });
    }
  }
};

export default cardController;