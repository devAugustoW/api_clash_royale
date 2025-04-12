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
	},

	// Função para buscar as 10 cartas menos populares
	async getLeastPopularCards(req, res) {
		try {
			const leastPopularCards = await mongoose.connection.db
				.collection('battles')
				.aggregate([
					// Filtrar 100 melhores jogadores por currentGlobalRank
					{
						$match: {
							currentGlobalRank: { $lte: 100 }
						}
					},
					// Projetar todas as cartas
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
					// Ordenando em ordem ascendente (menos populares primeiro)
					{ $sort: { count: 1 } },
					// Limita aos 10 principais resultados
					{ $limit: 10 },
					// Adiciona informações extras
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

			// Se não há cartas, retorna um erro
			if (leastPopularCards.length === 0) {
				return res.status(404).json({ 
					message: 'Nenhuma carta encontrada entre os 100 melhores jogadores' 
				});
			}
			
			// Buscar informações detalhadas das cartas menos populares
			const cardIds = leastPopularCards.map(card => card.cardId);
			
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
			const result = leastPopularCards.map(card => ({
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
			console.error('Erro ao buscar cartas menos populares:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar cartas menos populares', 
				details: error.message 
			});
		}
	},

	// Função para obter estatísticas de vitórias/derrotas por carta em um intervalo
	async getCardStats(req, res) {
		try {
			// Pegar parâmetros de intervalo de data
			const { startDate, endDate } = req.query;
			
			if (!startDate || !endDate) {
				return res.status(400).json({ 
					error: 'Parâmetros de data inicial e final são obrigatórios' 
				});
			}
			
			// Converter strings de data para objetos Date
			const start = new Date(startDate);
			const end = new Date(endDate);
			
			// Obter todas as cartas para análise
			const allCards = await mongoose.connection.db
				.collection('cards')
				.find({})
				.toArray();
			
			// Array para armazenar resultados de todas as cartas
			const cardStats = [];
			
			// Para cada carta, calcular estatísticas
			for (const card of allCards) {
				// Pipeline para contar vitórias/derrotas com essa carta
				const results = await mongoose.connection.db
					.collection('battles')
					.aggregate([
						{
							$match: {
								battleTime: { $gte: start, $lte: end },
								"cards.name": card.name
							}
						},
						{
							$group: {
								_id: "$hasWon",
								count: { $sum: 1 }
							}
						}
					])
					.toArray();
				
				// Calcular totais
				const total = results.reduce((sum, r) => sum + r.count, 0);
				const wins = results.find(r => r._id === true)?.count || 0;
				const losses = results.find(r => r._id === false)?.count || 0;
				
				// Calcular percentuais (evitar divisão por zero)
				const winPercentage = total > 0 ? (wins / total) * 100 : 0;
				const lossPercentage = total > 0 ? (losses / total) * 100 : 0;
				
				// Adicionar aos resultados apenas se a carta foi usada
				if (total > 0) {
					cardStats.push({
						cardId: card.id,
						name: card.name,
						elixirCost: card.elixirCost,
						rarity: card.rarity,
						iconUrl: card.iconUrls?.medium || null,
						totalBattles: total,
						wins,
						losses,
						winPercentage: parseFloat(winPercentage.toFixed(2)),
						lossPercentage: parseFloat(lossPercentage.toFixed(2))
					});
				}
			}
			
			// Ordenar por percentual de vitória (decrescente)
			cardStats.sort((a, b) => b.winPercentage - a.winPercentage);
			
			return res.json({
				timeRange: {
					startDate: start,
					endDate: end
				},
				count: cardStats.length,
				cards: cardStats
			});
		} catch (error) {
			console.error('Erro ao buscar estatísticas de cartas:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar estatísticas de cartas', 
				details: error.message 
			});
		}
	},

	// Resgata imagem e pipe-line com porcentagem de vitórias e derrotas
	async getCardStatsOptimized(req, res) {
		try {
			const { startDate, endDate } = req.query;
			
			if (!startDate || !endDate) {
				return res.status(400).json({ 
					error: 'Parâmetros de data inicial e final são obrigatórios' 
				});
			}
			
			const start = new Date(startDate);
			const end = new Date(endDate);
			
			// Pipeline otimizado que processa todas as cartas de uma vez
			const cardStats = await mongoose.connection.db
				.collection('battles')
				.aggregate([
					{
						$match: {
							battleTime: { $gte: start, $lte: end }
						}
					},
					// Desdobrar o array de cartas
					{ $unwind: "$cards" },
					// Agrupar por carta e resultado da batalha
					{
						$group: {
							_id: {
								cardId: "$cards.id",
								cardName: "$cards.name",
								hasWon: "$hasWon"
							},
							count: { $sum: 1 }
						}
					},
					// Agrupar para organizar estatísticas por carta
					{
						$group: {
							_id: {
								cardId: "$_id.cardId",
								cardName: "$_id.cardName"
							},
							stats: {
								$push: {
									hasWon: "$_id.hasWon",
									count: "$count"
								}
							},
							totalBattles: { $sum: "$count" }
						}
					},
					// Projetar os resultados no formato desejado
					{
						$project: {
							_id: 0,
							cardId: "$_id.cardId",
							name: "$_id.cardName",
							totalBattles: 1,
							wins: {
								$reduce: {
									input: {
										$filter: {
											input: "$stats",
											as: "stat",
											cond: { $eq: ["$$stat.hasWon", true] }
										}
									},
									initialValue: 0,
									in: { $add: ["$$value", "$$this.count"] }
								}
							},
							losses: {
								$reduce: {
									input: {
										$filter: {
											input: "$stats",
											as: "stat",
											cond: { $eq: ["$$stat.hasWon", false] }
										}
									},
									initialValue: 0,
									in: { $add: ["$$value", "$$this.count"] }
								}
							}
						}
					},
					// Adicionar percentuais
					{
						$addFields: {
							winPercentage: {
								$round: [
									{ $multiply: [{ $divide: ["$wins", "$totalBattles"] }, 100] },
									2
								]
							},
							lossPercentage: {
								$round: [
									{ $multiply: [{ $divide: ["$losses", "$totalBattles"] }, 100] },
									2
								]
							}
						}
					},
					// Ordenar por percentual de vitória
					{ $sort: { winPercentage: -1 } }
				])
				.toArray();
				
			// Buscar detalhes adicionais das cartas
			const cardIds = cardStats.map(card => card.cardId);
			
			const cardDetails = await mongoose.connection.db
				.collection('cards')
				.find({ id: { $in: cardIds } })
				.toArray();
			
			// Combinar estatísticas com detalhes das cartas
			const cardMap = {};
			cardDetails.forEach(card => {
				cardMap[card.id] = card;
			});
			
			const enrichedCardStats = cardStats.map(stat => ({
				...stat,
				elixirCost: cardMap[stat.cardId]?.elixirCost || null,
				rarity: cardMap[stat.cardId]?.rarity || null,
				iconUrl: cardMap[stat.cardId]?.iconUrls?.medium || null
			}));
			
			return res.json({
				timeRange: {
					startDate: start,
					endDate: end
				},
				count: enrichedCardStats.length,
				cards: enrichedCardStats
			});
		} catch (error) {
			console.error('Erro ao buscar estatísticas de cartas:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar estatísticas de cartas', 
				details: error.message 
			});
		}
	}
};

export default cardController;