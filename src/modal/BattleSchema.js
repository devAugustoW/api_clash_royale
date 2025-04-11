import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  id: Number,
  name: String,
  level: Number,
  starLevel: Number
});

const SupportCardSchema = new mongoose.Schema({
  id: Number,
  name: String,
  level: Number,
  count: Number
});

const PlayerSchema = new mongoose.Schema({
  tag: String,
  startingTrophies: Number,
  currentGlobalRank: Number,
  elixirLeaked: Number,
  crowns: Number,
  trophyChange: Number,
  kingTowerHitPoints: Number,
  princessTowersHitPoints: [Number],
  cards: [CardSchema],
  supportCards: [SupportCardSchema]
});

const BattleSchema = new mongoose.Schema({
  tag: String,
  battleTime: Date,
  isTeamBattle: Boolean,
  crowns: Number,
  trophyChange: Number,
  kingTowerHitPoints: Number,
  princessTowersHitPoints: [Number],
  currentGlobalRank: Number,
  elixirLeaked: Number,
  startingTrophies: Number,
  hasWon: Boolean,
  cards: [CardSchema],
  supportCards: [SupportCardSchema],
  team: [PlayerSchema],
  opponents: [PlayerSchema]
}, {
  collection: 'battles'
});

export default mongoose.model('Battle', BattleSchema);