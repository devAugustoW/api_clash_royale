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
  },

  // Função para buscar estatísticas gerais dos jogadores
  async getPlayerStats(req, res) {
    try {
      // Contar o total de jogadores
      const totalPlayers = await mongoose.connection.db
        .collection('players')
        .countDocuments();
      
      // Buscar estatísticas gerais usando agregação
      const playerStats = await mongoose.connection.db
        .collection('players')
        .aggregate([
          {
            $group: {
              _id: null,
              totalPlayers: { $sum: 1 },
              avgTrophies: { $avg: "$trophies" },
              maxTrophies: { $max: "$trophies" },
              minTrophies: { $min: "$trophies" },
              avgExpLevel: { $avg: "$expLevel" },
              avgWins: { $avg: "$wins" },
              avgBattleCount: { $avg: "$battleCount" },
              totalCards: { $sum: { $size: "$cards" } }
            }
          },
          {
            $project: {
              _id: 0,
              totalPlayers: 1,
              avgTrophies: { $round: ["$avgTrophies", 2] },
              maxTrophies: 1,
              minTrophies: 1,
              avgExpLevel: { $round: ["$avgExpLevel", 2] },
              avgWins: { $round: ["$avgWins", 2] },
              avgBattleCount: { $round: ["$avgBattleCount", 2] },
              avgCardsPerPlayer: { $round: [{ $divide: ["$totalCards", "$totalPlayers"] }, 2] }
            }
          }
        ])
        .toArray();
      
      // Buscar distribuição de troféus
      const trophyDistribution = await mongoose.connection.db
        .collection('players')
        .aggregate([
          {
            $bucket: {
              groupBy: "$trophies",
              boundaries: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
              default: "10000+",
              output: {
                count: { $sum: 1 },
                players: { $push: { tag: "$tag", name: "$name", trophies: "$trophies" } }
              }
            }
          }
        ])
        .toArray();
      
      // Buscar top 10 jogadores por troféus
      const topPlayers = await mongoose.connection.db
        .collection('players')
        .find({})
        .sort({ trophies: -1 })
        .limit(10)
        .project({
          tag: 1,
          name: 1,
          trophies: 1,
          expLevel: 1,
          wins: 1,
          losses: 1,
          battleCount: 1,
          _id: 0
        })
        .toArray();
      
      const responseData = {
        totalPlayers,
        statistics: playerStats[0] || {},
        trophyDistribution,
        topPlayers
      };
      
      return res.json(responseData);
      
    } catch (error) {
      console.error('Erro ao buscar estatísticas de jogadores:', error);
      return res.status(500).json({ 
        error: 'Erro ao buscar estatísticas de jogadores', 
        details: error.message 
      });
    }
  },

  // Função para buscar um jogador específico por tag
  async getPlayerByTag(req, res) {
    try {
      const { tag } = req.params;
      
      
      if (!tag) {
        return res.status(400).json({
          error: 'Tag do jogador é obrigatória'
        });
      }
      
      // Verificar o formato da tag e criar versões com e sem #
      let formattedTag = tag;
      let tagWithHash = tag;
      
      if (formattedTag.startsWith('#')) {
        formattedTag = formattedTag.substring(1);
      } else {
        tagWithHash = '#' + tag;
      }
      
      // Primeiro, tentar buscar sem o #
      let player = await mongoose.connection.db
        .collection('players')
        .findOne({ tag: formattedTag });
      
      // Se não encontrar, tentar com o #
      if (!player) {
        console.log("Jogador não encontrado sem #, tentando com #:", tagWithHash);
        player = await mongoose.connection.db
          .collection('players')
          .findOne({ tag: tagWithHash });
      }
      
      if (!player) {
        // Tente uma busca alternativa sem case-sensitivity em ambas as versões
        
        const playerAlternative = await mongoose.connection.db
          .collection('players')
          .findOne({ 
            $or: [
              { tag: { $regex: new RegExp(`^${formattedTag}$`, "i") } },
              { tag: { $regex: new RegExp(`^${tagWithHash}$`, "i") } }
            ]
          });
        
        if (playerAlternative) {
          return res.json(playerAlternative);
        }
        
        return res.status(404).json({
          error: `Jogador com tag ${tag} não encontrado`
        });
      }
      
      // Quando encontrar o jogador, enriquecer as informações das cartas
      if (player) {
        
        // Verificar se o jogador tem cartas
        if (player.cards && player.cards.length > 0) {
          // Extrair os IDs das cartas
          const cardIds = player.cards.map(card => card.id);
          
          // Buscar detalhes das cartas incluindo URLs das imagens
          const cardDetails = await mongoose.connection.db
            .collection('cards')
            .find({ id: { $in: cardIds } })
            .project({ id: 1, name: 1, iconUrls: 1, elixirCost: 1, rarity: 1, _id: 0 })
            .toArray();
          
          // Criar um mapa para facilitar a busca
          const cardMap = {};
          cardDetails.forEach(card => {
            cardMap[card.id] = card;
          });
          
          // Enriquecer os dados das cartas do jogador
          player.cards = player.cards.map(card => ({
            ...card,
            iconUrl: cardMap[card.id]?.iconUrls?.medium || null,
            elixirCost: cardMap[card.id]?.elixirCost || null,
            rarity: cardMap[card.id]?.rarity || null
          }));
          
        }
        
        // Fazer o mesmo para supportCards se existir
        if (player.supportCards && player.supportCards.length > 0) {
          const supportCardIds = player.supportCards.map(card => card.id);
          
          const supportCardDetails = await mongoose.connection.db
            .collection('cards')
            .find({ id: { $in: supportCardIds } })
            .project({ id: 1, name: 1, iconUrls: 1, elixirCost: 1, rarity: 1, _id: 0 })
            .toArray();
          
          const supportCardMap = {};
          supportCardDetails.forEach(card => {
            supportCardMap[card.id] = card;
          });
          
          player.supportCards = player.supportCards.map(card => ({
            ...card,
            iconUrl: supportCardMap[card.id]?.iconUrls?.medium || null,
            elixirCost: supportCardMap[card.id]?.elixirCost || null,
            rarity: supportCardMap[card.id]?.rarity || null
          }));
          
        }
      }
      
      return res.json(player);
      
    } catch (error) {
      console.error('Erro ao buscar jogador por tag:', error);
      return res.status(500).json({ 
        error: 'Erro ao buscar jogador por tag', 
        details: error.message 
      });
    }
  }
};

export default playerController;