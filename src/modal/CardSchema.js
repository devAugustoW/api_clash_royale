import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  name: String,
  id: Number,
  maxLevel: Number,
  rarity: String,
  elixirCost: Number,
  iconUrls: {
    medium: String
  },
  evolutionLevel: Number,
  maxEvolutionLevel: Number,
  is_supportive_card: Boolean
}, {
  collection: 'cards'
});

export default mongoose.model('Card', CardSchema);