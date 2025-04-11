import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  id: Number,
  name: String,
  level: Number,
  starLevel: Number,
  count: Number
});

const SupportCardSchema = new mongoose.Schema({
  id: Number,
  name: String,
  level: Number,
  count: Number
});

const PlayerSchema = new mongoose.Schema({
  tag: String,
  expLevel: Number,
  trophies: Number,
  bestTrophies: Number,
  wins: Number,
  losses: Number,
  battleCount: Number,
  threeCrownWins: Number,
  starPoints: Number,
  expPoints: Number,
  totalExpPoints: Number,
  cards: [CardSchema],
  supportCards: [SupportCardSchema]
}, {
  collection: 'players'
});

export default mongoose.model('Player', PlayerSchema);