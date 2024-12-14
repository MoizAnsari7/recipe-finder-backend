const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const favoriteRecipeSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  recipes: [
    {
      type: Number,
      required: true,
    },
  ],
});

const FavoriteRecipe = mongoose.model("FavoriteRecipe", favoriteRecipeSchema);

module.exports = FavoriteRecipe;
