import mongoose from 'mongoose';

const cardController = {
	// estudo de caso
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
  },

	// Função para buscar as 10 cartas mais populares
	async getTopPopularCards(req, res) {
		try {
			// Adaptando o pipeline Python para MongoDB/Node.js
			const popularCards = await mongoose.connection.db
				.collection('battles')
				.aggregate([
					// Filtrar apenas os 100 melhores jogadores por currentGlobalRank
					{
						$match: {
							currentGlobalRank: { $lte: 100 }
						}
					},
					// Projetar todas as cartas de todas as fontes
					{
						$project: {
							allCards: {
								$concatArrays: [
									{ $ifNull: ["$cards", []] },
									{
										$reduce: {
											input: { $ifNull: ["$team", []] },
											initialValue: [],
											in: {
												$concatArrays: ["$$value", { $ifNull: ["$$this.cards", []] }]
											}
										}
									},
									{
										$reduce: {
											input: { $ifNull: ["$opponents", []] },
											initialValue: [],
											in: {
												$concatArrays: ["$$value", { $ifNull: ["$$this.cards", []] }]
											}
										}
									}
								]
							}
						}
					},
					// Desconstrói o array para processar cada carta individualmente
					{ $unwind: "$allCards" },
					// Agrupa por ID da carta para contar frequência
					{
						$group: {
							_id: "$allCards.id",
							name: { $first: "$allCards.name" },
							count: { $sum: 1 }
						}
					},
					// Ordena por contagem (mais populares primeiro)
					{ $sort: { count: -1 } },
					// Limita aos 10 principais resultados
					{ $limit: 10 },
					// Adiciona informações extras como percentual de uso
					{
						$addFields: {
							cardId: "$_id"
						}
					},
					{
						$project: {
							_id: 0,
							cardId: 1,
							name: 1,
							count: 1
						}
					}
				])
				.toArray();

			// Se não há cartas populares, retorna um erro
			if (popularCards.length === 0) {
				return res.status(404).json({ 
					message: 'Nenhuma carta popular encontrada entre os 100 melhores jogadores' 
				});
			}
			
			// Buscar informações detalhadas das cartas mais populares
			const cardIds = popularCards.map(card => card.cardId);
			
			const cardDetails = await mongoose.connection.db
				.collection('cards')
				.find({ id: { $in: cardIds } })
				.toArray();
			
			// Mapeamento para combinar contagens com detalhes
			const cardMap = {};
			cardDetails.forEach(card => {
				cardMap[card.id] = card;
			});
			
			// Combinar informações
			const result = popularCards.map(card => ({
				...card,
				elixirCost: cardMap[card.cardId]?.elixirCost || null,
				rarity: cardMap[card.cardId]?.rarity || null,
				iconUrl: cardMap[card.cardId]?.iconUrls?.medium || null
			}));
			
			return res.json({
				count: result.length,
				cards: result
			});
		} catch (error) {
			console.error('Erro ao buscar cartas populares:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar cartas populares', 
				details: error.message 
			});
		}
	}
};

export default cardController;