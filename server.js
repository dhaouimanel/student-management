require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const Student = require("./models/Student");
const studentRoutes = require("./routes/students");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student_management";

const app = express();

/* ---------- Middlewares ---------- */
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Routes ---------- */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});
app.use("/api/students", studentRoutes);
app.use("/api", (req, res) => res.status(404).json({ message: "Route introuvable" }));

/* ---------- Gestion centralisée des erreurs ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Erreurs de validation Mongoose : on renvoie un message par champ
  if (err.name === "ValidationError") {
    const errors = {};
    Object.values(err.errors).forEach((e) => {
      errors[e.path] = e.name === "CastError" ? `Valeur invalide pour « ${e.path} »` : e.message;
    });
    return res.status(400).json({ message: "Données invalides", errors });
  }

  // Mauvais type de valeur (ex. un nombre attendu)
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Valeur invalide pour « ${err.path} »` });
  }

  // E-mail déjà utilisé (index unique)
  if (err.code === 11000) {
    return res.status(409).json({
      message: "Cet e-mail est déjà utilisé par un autre étudiant",
      errors: { email: "Cet e-mail est déjà utilisé" },
    });
  }

  // JSON mal formé dans la requête
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Corps de requête JSON invalide" });
  }

  console.error(err);
  res.status(500).json({ message: "Erreur interne du serveur" });
});

/* ---------- Démarrage ---------- */
async function start() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Student.init(); // crée l'index unique sur l'e-mail
    console.log("MongoDB connecté");
  } catch (error) {
    console.error("Impossible de se connecter à MongoDB :", error.message);
    console.error("Vérifiez que MongoDB est lancé ou que MONGODB_URI est correct dans le fichier .env");
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
}

// Le serveur ne démarre que si on lance "node server.js" (pas pendant les tests)
if (require.main === module) start();

module.exports = app;
