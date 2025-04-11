import mongoose from 'mongoose';

const battleController = {
	async getFirstFive(req, res) {
    try {
      // Acessando diretamente a collection sem um modelo predefinido
      const battles = await mongoose.connection.db
        .collection('battles')
        .find({})
        .limit(3)
        .toArray();
      
      return res.json({
        count: battles.length,
        battles
      });
    } catch (error) {
      console.error('Erro ao buscar batalhas:', error);
      return res.status(500).json({ error: 'Erro ao buscar batalhas', details: error.message });
    }
  },
  
};

export default battleController;