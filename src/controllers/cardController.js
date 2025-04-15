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
						// Filtrar os 100 melhores jogadores por currentGlobalRank
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

	// Função  estatísticas de vitórias/derrotas por carta em um intervalo de tempo
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
	},

	// Função para encontrar decks com alta taxa de vitória
	async getTopDecks(req, res) {
		try {
			// Obter parâmetros
			const { startDate, endDate, winrateThreshold = 0.6 } = req.query;
			
			if (!startDate || !endDate) {
				return res.status(400).json({ 
					error: 'Parâmetros de data inicial e final são obrigatórios' 
				});
			}
			
			// Converter strings para Date e o threshold para número
			const start = new Date(startDate);
			const end = new Date(endDate);
			const threshold = parseFloat(winrateThreshold);
			
			// Pipeline de agregação 
			const topDecks = await mongoose.connection.db
				.collection('battles')
				.aggregate([
					// 1. Filtrar pelo intervalo de datas
					{
						$match: {
							battleTime: {
								$gte: start,
								$lte: end
							}
						}
					},
					// 2. Criar uma lista de decks combinando cards + supportCards para todos os jogadores, agora com o tag
					{
						$project: {
							hasWon: 1,
							deckData: [
								// Deck do jogador principal
								{
									playerTag: "$tag",
									cards: {
										$concatArrays: [
											{ $map: { input: { $ifNull: ["$cards", []] }, as: "c", in: "$$c.id" } },
											{ $map: { input: { $ifNull: ["$supportCards", []] }, as: "c", in: "$$c.id" } }
										]
									}
								},
								// Decks dos membros do time
								{
									$map: {
										input: { $ifNull: ["$team", []] },
										as: "player",
										in: {
											playerTag: "$$player.tag",
											cards: {
												$concatArrays: [
													{ $map: { input: { $ifNull: ["$$player.cards", []] }, as: "c", in: "$$c.id" } },
													{ $map: { input: { $ifNull: ["$$player.supportCards", []] }, as: "c", in: "$$c.id" } }
												]
											}
										}
									}
								},
								// Decks dos oponentes
								{
									$map: {
										input: { $ifNull: ["$opponents", []] },
										as: "player",
										in: {
											playerTag: "$$player.tag",
											cards: {
												$concatArrays: [
													{ $map: { input: { $ifNull: ["$$player.cards", []] }, as: "c", in: "$$c.id" } },
													{ $map: { input: { $ifNull: ["$$player.supportCards", []] }, as: "c", in: "$$c.id" } }
												]
											}
										}
									}
								}
							]
						}
					},

					// 3. Desaplainar a estrutura para processar cada deck individualmente
					{ $unwind: "$deckData" },
					// 4. Desaplainar novamente para processar arrays aninhados
					{ $unwind: "$deckData" },
					
					// 5. Remover duplicatas nos decks e ordenar IDs
					{
						$project: {
							hasWon: 1,
							playerTag: "$deckData.playerTag",
							deck: { 
								$sortArray: { 
									input: { $setUnion: ["$deckData.cards", []] }, 
									sortBy: 1 
								} 
							}
						}
					},
					
					// 6. Agrupar por deck + playerTag e computar vitórias
					{
						$group: {
							_id: {
								deck: "$deck",
								playerTag: "$playerTag"
							},
							total: { $sum: 1 },
							wins: {
								$sum: { $cond: [{ $eq: ["$hasWon", true] }, 1, 0] }
							}
						}
					},
					
					// 7. Calcular taxa de vitória
					{
						$project: {
							deck: "$_id.deck",
							playerTag: "$_id.playerTag",
							_id: 0,
							wins: 1,
							total: 1,
							winrate: { $divide: ["$wins", "$total"] }
						}
					},
					
					// 8. Filtrar por winrate mínima
					{
						$match: {
							winrate: { $gt: threshold },
							total: { $gte: 5 } // Adicionando um mínimo de 5 batalhas para filtrar dados estatísticos mais relevantes
						}
					},
					
					// 9. Ordenar por taxa de vitória
					{ $sort: { winrate: -1 } },
					{ $limit: 20 }  // mostrar só os 10 melhores decks
				])
				.toArray();
			
			// Buscar informações das cartas para enriquecer os resultados
			const allCardIds = new Set();
			topDecks.forEach(deck => {
				deck.deck.forEach(cardId => allCardIds.add(cardId));
			});
			
			const cardDetails = await mongoose.connection.db
				.collection('cards')
				.find({ id: { $in: Array.from(allCardIds) } })
				.toArray();
			
			// Criar mapa de IDs de cartas para detalhes
			const cardMap = {};
			cardDetails.forEach(card => {
				cardMap[card.id] = card;
			});
			
			// Buscar informações dos jogadores (donos dos decks)
			const playerTags = topDecks.map(deck => deck.playerTag);
			const players = await mongoose.connection.db
				.collection('players')
				.find({ tag: { $in: playerTags } })
				.project({ tag: 1, name: 1, trophies: 1, expLevel: 1 })
				.toArray();
			
			// Criar mapa de tags para informações do jogador
			const playerMap = {};
			players.forEach(player => {
				playerMap[player.tag] = player;
			});
			
			// Adicionar informações detalhadas de cada carta nos decks e incluir dados do jogador
			const enrichedDecks = topDecks.map(deck => ({
				...deck,
				winratePercentage: parseFloat((deck.winrate * 100).toFixed(2)),
				player: {
					tag: deck.playerTag,
				},
				cards: deck.deck.map(cardId => ({
					id: cardId,
					name: cardMap[cardId]?.name || 'Carta desconhecida',
					elixirCost: cardMap[cardId]?.elixirCost || null,
					rarity: cardMap[cardId]?.rarity || null,
					iconUrl: cardMap[cardId]?.iconUrls?.medium || null
				})),
				averageElixirCost: parseFloat((
					deck.deck
						.reduce((sum, cardId) => sum + (cardMap[cardId]?.elixirCost || 0), 0) / 
					deck.deck.length
				).toFixed(2))
			}));
			
			return res.json({
				timeRange: {
					startDate: start,
					endDate: end
				},
				winrateThreshold: threshold * 100 + '%',
				count: enrichedDecks.length,
				decks: enrichedDecks
			});
		} catch (error) {
			console.error('Erro ao buscar melhores decks:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar melhores decks', 
				details: error.message 
			});
		}
	},

	// Função para obter o número de derrotas com um combo específico de cartas
	async getComboLoss(req, res) {
		try {
			const { combo, startDate, endDate } = req.query;
			
			// Verifica se o combo foi fornecido
			if (!combo) {
				return res.status(400).json({ 
					error: 'Parâmetro combo é obrigatório' 
				});
			}
			
			// Verifica se as datas foram fornecidas
			if (!startDate || !endDate) {
				return res.status(400).json({ 
					error: 'Parâmetros startDate e endDate são obrigatórios' 
				});
			}
			
			// Processa o parâmetro combo para extrair os dois nomes de cartas
			let comboArray;
			try {
				// Tenta converter de JSON
				comboArray = JSON.parse(combo);
				if (!Array.isArray(comboArray)) {
					comboArray = [combo];
				}
			} catch (e) {
				// Se não for JSON, divide por vírgula
				comboArray = combo.split(',').map(item => item.trim());
			}
			
			// Verifica se temos exatamente duas cartas
			if (comboArray.length !== 2) {
				return res.status(400).json({ 
					error: 'O combo deve conter exatamente duas cartas' 
				});
			}
			
			// Converte as datas para objetos Date
			const start = new Date(startDate);
			const end = new Date(endDate);
			
			// Buscar informações das cartas incluindo suas imagens
			const cardDetails = await mongoose.connection.db
				.collection('cards')
				.find({ name: { $in: comboArray } })
				.toArray();
			
			// Mapear os detalhes das cartas
			const cardMap = {};
			cardDetails.forEach(card => {
				cardMap[card.name] = {
					id: card.id,
					name: card.name,
					elixirCost: card.elixirCost,
					rarity: card.rarity,
					iconUrl: card.iconUrls?.medium || null
				};
			});
			
			// Verificar se todas as cartas foram encontradas
			const notFoundCards = comboArray.filter(name => !cardMap[name]);
			if (notFoundCards.length > 0) {
				return res.status(404).json({
					error: 'Algumas cartas não foram encontradas',
					notFoundCards
				});
			}
			
			// Constrói o pipeline para agregação
			const pipeline = [
				{
					$match: {
						battleTime: { $gte: start, $lte: end },
						hasWon: false
					}
				},
				{
					$project: {
						allCardNames: {
							$setUnion: [
								{ $map: { input: { $ifNull: ["$cards", []] }, as: "c", in: "$$c.name" } },
								{ $map: { input: { $ifNull: ["$supportCards", []] }, as: "c", in: "$$c.name" } },
								{
									$reduce: {
										input: { $ifNull: ["$team", []] },
										initialValue: [],
										in: {
											$setUnion: [
												"$$value",
												{
													$map: {
														input: { $ifNull: ["$$this.cards", []] },
														as: "c",
														in: "$$c.name"
													}
												},
												{
													$map: {
														input: { $ifNull: ["$$this.supportCards", []] },
														as: "sc",
														in: "$$sc.name"
													}
												}
											]
										}
									}
								}
							]
						}
					}
				},
				{
					$match: {
						allCardNames: { $all: comboArray }
					}
				},
				{
					$count: "loss_count"
				}
			];
			
			// Executa a agregação
			const result = await mongoose.connection.db
				.collection('battles')
				.aggregate(pipeline)
				.toArray();
			
			// Formata o resultado
			const lossCount = result.length > 0 ? result[0].loss_count : 0;
			
			return res.json({
				combo: comboArray.map(cardName => cardMap[cardName]),
				lossCount,
				dateRange: {
					startDate: start.toISOString(),
					endDate: end.toISOString()
				}
			});
		} catch (error) {
			console.error('Erro ao buscar derrotas com combo específico:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar derrotas com combo específico', 
				details: error.message 
			});
		}
	},

	// Função para buscar vitórias com carta específica em condições desafiadoras
	async victoriesWithLessCrows(req, res) {
		try {
			const { cardId, trophyPercentage, matchDuration, towersDestroyed } = req.query;
			
			// Validação de parâmetros obrigatórios
			if (!cardId || !trophyPercentage || !matchDuration || !towersDestroyed) {
				return res.status(400).json({
					error: 'Parâmetros obrigatórios não fornecidos',
					requiredParams: ['cardId', 'trophyPercentage', 'matchDuration', 'towersDestroyed']
				});
			}
			
			// Converter parâmetros para números
			const cardIdNumber = parseInt(cardId);
			const trophyPercent = parseFloat(trophyPercentage);
			const duration = parseInt(matchDuration); // mantido para compatibilidade mas não usado
			const towers = parseInt(towersDestroyed);
			
			// Verificar se a carta existe
			const cardExists = await mongoose.connection.db
				.collection('cards')
				.findOne({ id: cardIdNumber });
				
			if (!cardExists) {
				return res.status(404).json({
					error: `Carta com ID ${cardIdNumber} não encontrada`
				});
			}
			
			// Obter estatísticas básicas de batalhas
			const totalBattles = await mongoose.connection.db
				.collection('battles')
				.countDocuments();
			
			const battlesWithCard = await mongoose.connection.db
				.collection('battles')
				.countDocuments({
					$or: [
						{ "cards.id": cardIdNumber },
						{ "team.cards.id": cardIdNumber }
					]
				});
			
			const winningBattles = await mongoose.connection.db
				.collection('battles')
				.countDocuments({
					$or: [
						{
							"hasWon": true,
							"cards.id": cardIdNumber
						},
						{
							"isTeamBattle": true,
							"team.cards.id": cardIdNumber
						}
					]
				});
			
			console.log("🎯 Parâmetros recebidos:", {
				cardIdNumber,
				trophyPercent,
				duration,
				towers
			});

			// Pipeline de agregação para encontrar vitórias que atendem aos critérios
			const finalPipeline = [
				// 1. Filtrar por vitórias com a carta específica
				{
					$match: {
						$or: [
							{
								$and: [
									{ hasWon: true },
									{
										$or: [
											{ "cards.id": cardIdNumber },
											{ "supportCards.id": cardIdNumber }
										]
									}
								]
							},
							{
								isTeamBattle: true,
								team: {
									$elemMatch: {
										$or: [
											{ "cards.id": cardIdNumber },
											{ "supportCards.id": cardIdNumber }
										]
									}
								}
							}
						]
					}
				},
				
				// 2. Calcular troféus e torres
				{
					$project: {
						battleTime: 1,
						hasWon: 1,

						winnerTrophies: "$startingTrophies",
						loserTrophies: { $max: { $ifNull: ["$opponents.startingTrophies", [0]] } },

						trophyPercentDifference: {
							$cond: [
								{ $gt: [{ $max: { $ifNull: ["$opponents.startingTrophies", [0]] } }, 0] },
								{
									$multiply: [
										{
											$divide: [
												{
													$subtract: [
														{ $max: { $ifNull: ["$opponents.startingTrophies", [0]] } },
														"$startingTrophies"
													]
												},
												{ $max: { $ifNull: ["$opponents.startingTrophies", [0]] } }
											]
										},
										100
									]
								},
								0
							]
  						},
						
						// Torres tomadas pelo oponente quando o jogador venceu
						towersTakenByLoser: {
							$max: {
								$map: {
									input: { $ifNull: ["$opponents", []] },
									as: "opp",
									in: { $ifNull: ["$$opp.crowns", 0] }
								}
							}
						}
					}
				},
				
				// 3. Filtrar batalhas onde o vencedor tinha X% menos troféus que o perdedor
				{
					$match: {
						$expr: {
							$and: [
								// Garantir valores válidos
								{ $gt: ["$winnerTrophies", 0] },
								{ $gt: ["$loserTrophies", 0] },
								
								// Calcular se a diferença percentual é pelo menos o valor especificado
								{ $gte: ["$trophyPercentDifference", trophyPercent] }
							]
						}
					}
				},
				
				// 4. Filtrar por torres destruídas pelo perdedor
				{
					$match: {
						towersTakenByLoser: towers
					}
				},
				
				// 5. Contar resultados
				{
					$count: "totalVictories"
				}
			];

			if (req.query.debugMode === 'true') {
				return res.json({
					pipeline: JSON.stringify(finalPipeline, null, 2)
				});
			}

			
			const results = await mongoose.connection.db
				.collection('battles')
				.aggregate(finalPipeline)
				.toArray();
			
			// Formatar e retornar a resposta
			return res.json({
				card: {
					id: cardIdNumber,
					name: cardExists.name,
					iconUrl: cardExists.iconUrls?.medium || null
				},
				criteria: {
					trophyDifference: `${trophyPercent}% menos troféus`,
					matchDuration: `${duration} segundos (ignorado - campo não existe)`,
					towersDestroyed: towers
				},
				statistics: {
					totalBattles,
					battlesWithCard,
					winningBattles,
					victoryCount: results.length > 0 ? results[0].totalVictories : 0
				}
			});
			
		} catch (error) {
			console.error('Erro ao buscar vitórias com menos troféus:', error);
			return res.status(500).json({
				error: 'Erro ao processar consulta de vitórias',
				details: error.message
			});
		}
	},

	// Função para buscar todas as cartas com seus nomes e IDs
	async getAllCards(req, res) {
		try {
			// Buscar todas as cartas da coleção, projetando apenas nome e ID
			const cards = await mongoose.connection.db
				.collection('cards')
				.find({})
				.project({ name: 1, id: 1, _id: 0 })
				.sort({ name: 1 }) // Ordena alfabeticamente por nome
				.toArray();
			
			// Verifica se foram encontradas cartas
			if (cards.length === 0) {
				return res.status(404).json({ 
					message: 'Nenhuma carta encontrada no sistema' 
				});
			}
			
			// Retorna a lista de cartas
			return res.json({
				count: cards.length,
				cards
			});
		} catch (error) {
			console.error('Erro ao buscar lista de cartas:', error);
			return res.status(500).json({ 
				error: 'Erro ao buscar lista de cartas', 
				details: error.message 
			});
		}
	},

	// Função para encontrar combos de cartas com alta taxa de vitória
	async getWinningCardCombo(req, res) {
		try {
			// Obter parâmetros
			const { comboSize, winRateThreshold, startDate, endDate } = req.query;
			
			
			// Validação de parâmetros
			if (!comboSize || !startDate || !endDate || !winRateThreshold) {
				return res.status(400).json({ 
					error: 'Parâmetros obrigatórios não fornecidos',
					requiredParams: ['comboSize', 'winRateThreshold', 'startDate', 'endDate']
				});
			}
			
			// Converter strings para números/datas - com ajuste de fuso horário
			const size = parseInt(comboSize);
			const threshold = parseFloat(winRateThreshold) / 100; // Converter percentual para decimal
			
			// Corrigir problema de timezone nas datas
			// Para a data inicial, garantimos que seja o início do dia (00:00:00) no fuso horário local
			const startParts = startDate.split('-').map(Number);
			const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0);
			
			// Para a data final, garantimos que seja o final do dia (23:59:59) no fuso horário local
			const endParts = endDate.split('-').map(Number);
			const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59);
			
			// Validar valores
			if (isNaN(size) || size < 2 || size > 8) {
				return res.status(400).json({ 
					error: 'Tamanho de combo inválido. Deve ser entre 2 e 8 cartas' 
				});
			}
			
			if (isNaN(threshold) || threshold < 0 || threshold > 1) {
				return res.status(400).json({ 
					error: 'Taxa de vitória inválida. Deve ser entre 0 e 100%' 
				});
			}
			
			// Definir limite de combinações por batalha para evitar explosão combinatória
			const MAX_COMBOS_POR_BATALHA = 100;
			
			// Buscar apenas batalhas no intervalo de datas
			// Otimização: filtrar no MongoDB as batalhas que não têm cartas suficientes
			const battles = await mongoose.connection.db
				.collection('battles')
				.find(
					{ 
						battleTime: { $gte: start, $lte: end },
						"cards": { $exists: true, $not: { $size: 0 } },
						$expr: { $gte: [{ $size: "$cards" }, size] } // Apenas batalhas com cartas suficientes
					},
					{ 
						projection: { 
							hasWon: 1, 
							"cards.id": 1, 
							"cards.name": 1 
						} 
					}
				)
				.toArray();
			
			console.log(`Recuperadas ${battles.length} batalhas válidas no período`);
			
			// Mapa para armazenar informações dos combos (usando apenas IDs como chaves)
			const comboMap = new Map();
			
			// Função auxiliar para gerar combinações
			function generateCombinations(arr, size) {
				const result = [];
				
				function backtrack(start, current) {
					if (current.length === size) {
						result.push([...current]);
						return;
					}
					
					for (let i = start; i < arr.length; i++) {
						current.push(arr[i]);
						backtrack(i + 1, current);
						current.pop();
					}
				}
				
				backtrack(0, []);
				return result;
			}
			
			// Para cada batalha, gerar combinações e registrar vitórias/derrotas
			let battlesProcessed = 0;
			const totalBattles = battles.length;
			let combosTotais = 0;
			
			for (const battle of battles) {
				// Normalizar os cards antes de gerar as combinações (ordenar por ID)
				const cardsSorted = [...battle.cards].sort((a, b) => a.id - b.id);
				
				// Gerar combinações e limitar a quantidade para evitar explosão combinatória
				const cardCombos = generateCombinations(cardsSorted, size).slice(0, MAX_COMBOS_POR_BATALHA);
				combosTotais += cardCombos.length;
				
				// Para cada combo, registrar se houve vitória ou não
				for (const combo of cardCombos) {
					// Criar chave única para o combo usando apenas IDs
					const comboKey = combo.map(card => card.id).join('_');
					
					// Atualizar estatísticas do combo (armazenando apenas IDs, não objetos completos)
					if (!comboMap.has(comboKey)) {
						comboMap.set(comboKey, {
							cardIds: combo.map(card => card.id),
							cardNames: combo.map(card => card.name),
							totalBattles: 1,
							victories: battle.hasWon ? 1 : 0
						});
					} else {
						const stats = comboMap.get(comboKey);
						stats.totalBattles++;
						if (battle.hasWon) stats.victories++;
					}
				}
				
				// Registrar progresso a cada 100 batalhas
				battlesProcessed++;
				if (battlesProcessed % 100 === 0 || battlesProcessed === totalBattles) {
					console.log(`Processadas ${battlesProcessed}/${totalBattles} batalhas (${Math.round(battlesProcessed/totalBattles*100)}%)`);
					console.log(`Combos acumulados até agora: ${comboMap.size}, gerados: ${combosTotais}`);
				}
			}
			
			console.log(`Processamento completo. ${battlesProcessed} batalhas analisadas.`);
			console.log(`Combos únicos encontrados: ${comboMap.size} de ${combosTotais} gerados`);
			
			// Calcular taxa de vitória e filtrar por threshold
			const comboResults = Array.from(comboMap.values())
				.map(combo => ({
					...combo,
					winRate: combo.victories / combo.totalBattles * 100
				}))
				.filter(combo => combo.winRate >= threshold * 100 && combo.totalBattles >= 5) // adicionar um mínimo de 5 batalhas
				.sort((a, b) => b.winRate - a.winRate || b.totalBattles - a.totalBattles)
				.slice(0, 10); // limitar a 10 resultados
			
			console.log(`${comboResults.length} combos atendem aos critérios mínimos`);
			
			// Verificar resultados
			if (comboResults.length === 0) {
				console.log('Nenhum resultado encontrado com os critérios especificados');
				return res.status(404).json({
					message: `Nenhum combo de ${size} cartas encontrado com taxa de vitória acima de ${(threshold * 100).toFixed(1)}% no período especificado`
				});
			}
			
			// Coletar IDs de todas as cartas para buscar detalhes
			const cardIds = new Set();
			comboResults.forEach(result => {
				result.cardIds.forEach(id => cardIds.add(id));
			});
			
			// Buscar detalhes das cartas (incluindo URLs das imagens)
			const cardDetails = await mongoose.connection.db
				.collection('cards')
				.find({ id: { $in: Array.from(cardIds) } })
				.project({ id: 1, name: 1, iconUrls: 1, elixirCost: 1, rarity: 1, _id: 0 })
				.toArray();
			
			// Criar mapa de IDs para detalhes das cartas
			const cardMap = {};
			cardDetails.forEach(card => {
				cardMap[card.id] = card;
			});
			
			// Enriquecer os resultados com detalhes das cartas
			const enrichedResults = comboResults.map(result => {
				const enrichedCombo = result.cardIds.map(cardId => ({
					id: cardId,
					name: cardMap[cardId]?.name || result.cardNames[result.cardIds.indexOf(cardId)] || 'Desconhecida',
					iconUrl: cardMap[cardId]?.iconUrls?.medium || null,
					elixirCost: cardMap[cardId]?.elixirCost || null,
					rarity: cardMap[cardId]?.rarity || null
				}));
				
				return {
					totalBattles: result.totalBattles,
					victories: result.victories,
					winRate: parseFloat(result.winRate.toFixed(2)),
					combo: enrichedCombo,
					// Calcular custo médio de elixir do combo
					averageElixirCost: parseFloat((
						enrichedCombo.reduce((sum, card) => sum + (card.elixirCost || 0), 0) / 
						enrichedCombo.length
					).toFixed(2))
				};
			});
			
			// Retornar resultados
			const response = {
				query: {
					comboSize: size,
					winRateThreshold: threshold * 100,
					period: {
						startDate: start,
						endDate: end
					}
				},
				result: {
					count: enrichedResults.length,
					combos: enrichedResults
				}
			};
			
			return res.json(response);
		} catch (error) {
			console.error('Erro ao buscar combos vencedores:', error);
			return res.status(500).json({ 
				error: 'Erro ao processar a busca de combos', 
				details: error.message 
			});
		}
	}
};

export default cardController;