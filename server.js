const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("./Schema/User");
const FavoriteRecipe = require("./Schema/FavoriteRecipe");
require("dotenv").config();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/ReceipeFinder", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Forbidden - Invalid Token" });
      }
      req.user = user;
      next();
    });
  } else {
    return res.status(401).json({ message: "Unauthorized - Token Required" });
  }
};

// Register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    console.log("User", User);

    const newUser = await user.save();
    console.log("newUser", newUser);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    if (error.code === 11000) {
      console.log(error, "error");

      res.status(400).json({ message: "Username already exists" });
    } else {
      res.status(500).json({ message: "Error registering user" });
    }
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && (await bcrypt.compare(password, user.password))) {
      console.table(user);
      
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.json({ token });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error logging in" });
  }
});

// Get recipes
app.get("/api/recipes", async (req, res) => {
  try {
    const { ingredients } = req.query;
    if (!ingredients) {
      return res
        .status(400)
        .json({ message: "Ingredients query parameter is required" });
    }
    const response = await axios.get(
      "https://api.spoonacular.com/recipes/findByIngredients",
      {
        params: {
          ingredients,
          number: 100,
          apiKey: process.env.SPOONACULAR_API_KEY,
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching recipes:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add favorite
app.post("/api/favorites", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  const { recipeId } = req.body;

  try {
    let favorite = await FavoriteRecipe.findOne({ user: userId });

    if (favorite) {
      if (!favorite.recipes.includes(recipeId)) {
        favorite.recipes.push(recipeId);
        await favorite.save();
        return res.status(200).json({ message: "Recipe added to favorites" });
      } else {
        return res
          .status(400)
          .json({ message: "Recipe is already in favorites" });
      }
    } else {
      const newFavorite = new FavoriteRecipe({
        user: userId,
        recipes: [recipeId],
      });
      await newFavorite.save();
      return res
        .status(201)
        .json({ message: "Favorite list created and recipe added" });
    }
  } catch (error) {
    console.error("Error adding favorite:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Get user's favorite recipes
app.get("/api/favorites", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  try {
    const favorite = await FavoriteRecipe.findOne({ user: userId });
    if (favorite) {
      res.json(favorite.recipes);
    } else {
      res.status(404).json({ message: "No favorite recipes found" });
    }
  } catch (error) {
    console.error("Error fetching favorite recipes:", error);
    res.status(500).json({ message: "Error fetching favorite recipes" });
  }
});

// Get detailed favorite recipes
app.get("/api/favorites/details", authenticateJWT, async (req, res) => {
  const { userId } = req.user;
  try {
    const favorite = await FavoriteRecipe.findOne({ user: userId });
    if (favorite) {
      const recipes = favorite.recipes;
      const recipeDetails = await Promise.all(
        recipes.map(async (recipeId) => {
          const response = await axios.get(
            `https://api.spoonacular.com/recipes/${recipeId}/information`,
            {
              params: { apiKey: process.env.SPOONACULAR_API_KEY },
            }
          );
          console.log("favorite.recipes", response.data);
          return response.data;
        })
      );
      res.json(recipeDetails);
    } else {
      res.status(404).json({ message: "No favorite recipes found" });
    }
  } catch (error) {
    console.error("Error fetching detailed favorite recipes:", error);
    res
      .status(500)
      .json({ message: "Error fetching detailed favorite recipes" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
