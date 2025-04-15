import mongoose from 'mongoose';

const battleController = {
	// estudo de caso
	async getFirstOne(req, res) {
    try {
      // Acessando diretamente a collection sem um modelo predefinido
      const battles = await mongoose.connection.db
        .collection('battles')
        .find({})
        .limit(2)
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

	// Função para stats de batalhas
	async getBattlesStats(req, res) {
		try {
			// Obtendo o total de documentos na collection
			const totalBattles = await mongoose.connection.db
				.collection('battles')
				.countDocuments();
			
			// Obtendo a data mais antiga e mais recente
			const dateStats = await mongoose.connection.db
				.collection('battles')
				.aggregate([
					{
						$group: {
							_id: null,
							oldestDate: { $min: "$battleTime" },
							newestDate: { $max: "$battleTime" }
						}
					},
					{
						$project: {
							_id: 0,
							oldestDate: 1,
							newestDate: 1
						}
					}
				])
				.toArray();
			
			// Preparando a resposta
			const stats = {
				totalBattles,
				dateRange: dateStats.length > 0 ? {
					oldestBattle: dateStats[0].oldestDate,
					newestBattle: dateStats[0].newestDate,
					daysSpan: dateStats[0].newestDate && dateStats[0].oldestDate ? 
						Math.round((new Date(dateStats[0].newestDate) - new Date(dateStats[0].oldestDate)) / (1000 * 60 * 60 * 24)) : 
						null
				} : {
					oldestBattle: null,
					newestBattle: null,
					daysSpan: null
				}
			};
			
			return res.json(stats);
		} catch (error) {
			console.error('Erro ao buscar estatísticas de batalhas:', error);
			return res.status(500).json({ error: 'Erro ao buscar estatísticas', details: error.message });
		}
	},

  // Função para pegar uma lista de batalhas
  async getBattleList(req, res) {
    try {
      const battles = await mongoose.connection.db
        .collection('battles')
        .aggregate([
          { $limit: 15 },
          {
            $project: {
              battleId: { $toString: "$_id" },
              battleTime: 1,
              // Jogador 1 (principal)
              player1Id: "$tag",
              player1Rank: "$currentGlobalRank",
              player1HasWon: "$hasWon",
              player1Crowns: "$crowns",
              // Jogador 2 (oponente - primeiro da lista de oponentes)
              player2Id: { $arrayElemAt: ["$opponents.tag", 0] },
              player2Rank: { $arrayElemAt: ["$opponents.currentGlobalRank", 0] },
              player2HasWon: { $cond: [{ $eq: ["$hasWon", true] }, false, true] }, // Lógica inversa ao player1
              player2Crowns: { $arrayElemAt: ["$opponents.crowns", 0] }
            }
          },
          {
            $sort: { battleTime: -1 }  // Ordenando por horário da batalha (mais recente primeiro)
          }
        ])
        .toArray();
      
      return res.json({
        count: battles.length,
        battles
      });
    } catch (error) {
      console.error('Erro ao buscar lista de batalhas:', error);
      return res.status(500).json({ error: 'Erro ao buscar lista de batalhas', details: error.message });
    }
  },
};

export default battleController;