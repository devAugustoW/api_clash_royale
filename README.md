# API Clash Royale com MongoDB

![Clash Royale Banner](https://supercell.com/images/c96611b5b4ccd331e2b4dcb797811894/1281/hero_bg_clashroyale.612fcf42.webp)

Este projeto é uma API desenvolvida em Node.js que se comunica com um banco de dados MongoDB. A API fornece informações sobre o jogo Clash Royale, permitindo a extração de dados e estatísticas relevantes.

## Estudo das Collections Battles, Cards e Players

Iniciamos os estudos da estrutura dos dados no MongoDB através das rotas: `/api/battles`, `/api/cards`, `/api/players` e funções `getFirstOne`, `getTwoCards`, e `getTwoPlayers`. Assim, pude entender como os dados estavam dispostos, que tipo de informações eu poderia extrair e o caminho para responder as perguntas do professor.

## ✅ Pergunta 01

**Calcule a porcentagem de vitórias e derrotas utilizando a carta X (parâmetro) ocorridas em um intervalo de timestamps (parâmetro).**

###  O que é necessário para responder esta pergunta:
- **ID da carta (cardId)** a ser analisado
- **Batalhas com a Carta**
- **Data de início e fim** do intervalo desejado

A aplicação calcula automaticamente a proporção de vitórias e derrotas em batalhas onde a carta foi utilizada, considerando apenas as partidas dentro do período informado.

- rota `/stats` 
- controller `getCardStats`

```javascript
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
```
- Acessa a collectin 'battles
- Filtro para batalhas em um intervalo de tempo
- "cards.name": card.name: Garante que a carta atual (card.name) está presente nas cartas utilizadas na batalha.
- "$group": Agrupa os documentos com base no campo hasWon.
- _id: "$hasWon": Agrupamento por resultado da batalha:
	- true → vitória
	- false → derrota
- count: { $sum: 1 }: Conta quantos documentos (batalhas) existem em cada grupo.

✅ Resultado: Retorna a quantidade de vitórias e derrotas em que a carta foi utilizada dentro do período informado.
## Resposta da API

```Javascript
return res.json({
	timeRange: {
		startDate: start,
		endDate: end
	},
	count: cardStats.length,
	cards: cardStats
});
```

## ✅ Pergunta 02

**Liste os decks completos que produziram mais de X% (parâmetro) de vitórias ocorridas em um intervalo de timestamps (parâmetro).**

- Data de início e fim do intervalo desejado.
- Lista de Decks Vitoriosos
- Porcentagem mínima de vitórias (winrateThreshold) para filtrar os decks.

A função traz uma lista dos decks com maior taxa de vitória dentro do intervalo de tempo.

- rota `/top-decks`
- controller `getTopDecks`

```Javascript
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
```
- Filtro por intervalo de tempo.
- Criação de lista de decks.
- Remoção de duplicatas e ordenação de IDs.
- Agrupamento por deck e jogador, computando vitórias.
- Cálculo da taxa de vitória.
- Filtro por taxa de vitória mínima.
- Ordenação por taxa de vitória.

✅ Resultado: Retorna os decks com taxa de vitória acima do limite especificado, dentro do período informado.

Resposta enviada para o Front end

```Javascript
return res.json({
	timeRange: {
		startDate: start,
		endDate: end
	},
	winrateThreshold: threshold * 100 + '%',
	count: enrichedDecks.length,
	decks: enrichedDecks
});
```

## ✅ Pergunta 03

**Calcule a quantidade de derrotas utilizando o combo de cartas
 (X1,X2, ...) (parâmetro) ocorridas em um intervalo de timestamps
 (parâmetro).**

 - Receber duas cartas do Frontend - Combo de cartas (X1, X2, ...)
 - Data de início e fim do intervalo desejado.
 - Contar derrotas com o combo

 A função calcula o número de derrotas em que um combo específico de cartas foi utilizado, dentro do intervalo de tempo especificado.

 - rota `/combo-loss`
 - controller `getComboLoss`

 ```Javascript
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
```

- Filtrar por intervalo de tempo e derrotas.
- Projeção de todos os nomes de cartas usadas na batalha.
	- Cria um único array que contenha todos os nomes das cartas utilizadas em uma batalha.
- Filtrar batalhas por combo de cartas.
- Contagem das derrotas com o combo especificado.

✅ Resultado: Retorna o número de derrotas em que o combo de cartas foi utilizado, dentro do período informado.

Resposta enviada para o Frontend

```Javascript
			return res.json({
				combo: comboArray.map(cardName => cardMap[cardName]),
				lossCount,
				dateRange: {
					startDate: start.toISOString(),
					endDate: end.toISOString()
				}
			});
```

## ✅ Pergunta 04

**Calcule a quantidade de vitórias envolvendo a carta X (parâmetro) nos casos em que o vencedor possui Z% (parâmetro) menos troféus do que o perdedor, a partida durou menos de 2 minutos, e o perdedor derrubou ao menos duas torres do adversário.**

- ID da carta (cardId) a ser analisada.
- Porcentagem mínima de diferença de troféus (trophyPercentage) entre o vencedor e o perdedor.
- Número mínimo de torres destruídas pelo perdedor (towersDestroyed).
- Duração máxima da partida (matchDuration) em minutos.

A função victoriesWithLessCrows é responsável por buscar vitórias em batalhas onde uma carta específica foi utilizada. Ela verifica se a carta foi usada em vitórias onde o jogador tinha uma porcentagem menor de troféus em comparação com o oponente e onde o oponente destruiu um número específico de torres.

- Rota`/victories-with-less`
- Controller `victoriesWithLessCrows`

```javascript
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
```

- Identifica a carta no Banco de Dados
- Conta o número total de documentos na coleção 'battles'.
- Conta o número de batalhas onde a carta especificada foi utilizada.
- Procura por batalhas onde o jogador principal venceu e usou a carta, ou batalhas de equipe onde o time venceu e um dos membros usou a carta.
- Filtro por vitórias com a carta específica.
- Cálculo da diferença de troféus e torres destruídas.
- Filtro por diferença de troféus.
- Filtro por torres destruídas.
- Contagem das vitórias que atendem aos critérios.

✅ Resultado: Retorna o número de vitórias que atendem a todos os critérios.

```Javascript
return res.json({
	card: {
		id: cardIdNumber,
		name: cardExists.name,
		iconUrl: cardExists.iconUrls?.medium || null
	},
	criteria: {
		trophyDifference: `${trophyPercent}% menos troféus`,
		matchDuration: `${duration} segundos`,
		towersDestroyed: towers
	},
	statistics: {
		totalBattles,
		battlesWithCard,
		winningBattles,
		victoryCount: results.length > 0 ? results[0].totalVictories : 0
	}
});
```

## ✅ Pergunta 05

**Liste o combo de cartas (eg: carta 1, carta 2, carta 3... carta n) de tamanho N (parâmetro) que produziram mais de Y% (parâmetro) de vitórias ocorridas em um intervalo de timestamps (parâmetro).**

-   Número de cartas no combo.
-   Taxa de vitória mínima (winRateThreshold): Percentual mínimo de vitórias para o combo ser considerado.
-   Data de início (startDate): Início do intervalo de tempo para análise.
-   Data de término (endDate): Fim do intervalo de tempo para análise.

A função lista os combos de cartas com o tamanho especificado que atingiram a taxa de vitória mínima no intervalo de tempo fornecido.

-   Rota `/winning-combo`
-   Controller `getWinningCardCombo`

```Javascript
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
```
- Filtra batalhas com base no tempo
- Projeta os campos que devem ser incluídos no resultado da pesquisa

```Javascript
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
```
- Processa as batalhas recuperadas do banco de dados para gerar combinações de cartas e calcular estatísticas de vitória para cada combinação.

```Javascript
const comboResults = Array.from(comboMap.values())
	.map(combo => ({
		...combo,
		winRate: combo.victories / combo.totalBattles * 100
	}))
	.filter(combo => combo.winRate >= threshold * 100 && combo.totalBattles >= 5) // adicionar um mínimo de 5 batalhas
	.sort((a, b) => b.winRate - a.winRate || b.totalBattles - a.totalBattles)
	.slice(0, 10); // limitar a 10 resultados

console.log(`${comboResults.length} combos atendem aos critérios mínimos`);
```
 - Este trecho processa as estatísticas de combinações de cartas armazenadas no mapa `comboMap` e filtra os resultados para retornar apenas os combos mais relevantes e com maior taxa de vitória.
- Foi preciso redizir o range para 100 batalhas pois o calculo de combinações de cartas em filtro para todas as batalhas estava ocasionando problema de 'Memory Leak'

✅ Resultado: Retorna um array de combos de cartas que atendem aos critérios especificados, com detalhes das cartas e estatísticas de vitória.

```Javascript
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
```

## ✅ Combinações extras

### Realizamos algumaas combinações extras para trazer informações gerais sobre as batalhas

- Listar todas as batalhas existem no Banco de Dados
- Traz um histórico de batalhas
- Visão geral sobre cada batalha

- Rota `/list`
- Controller `getBattleList`

```Javascript
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
```

✅ Resultado: A função traz uma lista com visão geral sobre as batalhas, jogadores, vencedor e número de coroas de cada jogador

```Javascript
return res.json({
	count: battles.length,
	battles
});
```
## Dados quantitativos sobre a Collection Battle

- Estatísticas gerais sobre as batalhas
- Número total de batalhas
- Intervalo de datas (data mais antiga e mais recente) das batalhas.

- Rota `/stats`
- Controller  `getBattlesStats`

```Javascript
const totalBattles = await mongoose.connection.db
	.collection('battles')
	.countDocuments();
```
- Conta a quantidade de batalhas na collection Battle

```Javascript
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
```
- Consulta para obter data mais antiga e data mais recente

✅ Resultado: A função fornece informações primparias sobre as batalhas

```Javascript
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
```

## Cartas Mais ppulares

Realizamos uma consulta para descobrir as 10 cartas mais usadas entre os 100 melhoresjogadores do Rankink

- Rota `/popular`
- Controller `getTopPopularCards`

```Javascript
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
```
- Filtra as batalhas entre os 100 melhores jogadores
- Criar um Array com todas as casrtas usadas na batalha
- Agrupa as cartas por ID 
- Calcula a contagem de uso das cartas
- Armazena o nome das cartas
- Organiza exibição por cartas mais usadas
- Limita a exibição para 10 resultados de pesquisa
- Armazena em um objeto o Id , o nome e a contagem da carta para o Resultado da pesquisa

✅ Resultado: A função fornece informações sobre as cartas mais populares entre os melhores jogadores

```Javascript
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
```

## Cartas Menos Populares

Realizamos uma consulta para descobrir as 10 cartas menos usadas entre os 100 melhoresjogadores do Rankink

- Rota `/least-popular`
- Controller `getLeastPopularCards`

```Javascript
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

```

- Filtra pesquisa pelas batalhas com os  melhores jogadores
- Agrupa todas as cartas de uma batalha em um Array
- Agrupa as cartas por ID, Nome e contagem
- Ordena a exibição por cartas menos usadas
- Limita a exibição para  resultados de pesquisa

✅ Resultado: A função fornece informações sobre as cartas menos usadas entre os melhores jogadores

```Javascript
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
```
