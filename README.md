# Student Management System

Application full stack de gestion d'étudiants : ajouter, consulter, modifier et supprimer des dossiers étudiants.

- **Frontend** : HTML, CSS, JavaScript (sans framework), servi par Express
- **Backend** : Node.js, Express, API REST
- **Base de données** : MongoDB avec Mongoose

## Fonctionnalités

- Ajouter, modifier, supprimer un étudiant (CRUD complet)
- Voir la fiche détaillée d'un étudiant
- Recherche par nom, prénom ou e-mail
- Filtre par filière et tri (récents, nom, niveau)
- Pagination, statistiques et messages de confirmation
- Validation des données côté client **et** côté serveur (e-mail unique, champs obligatoires, etc.)
- Interface responsive avec mode sombre automatique

## Prérequis

- [Node.js](https://nodejs.org) version **20.19 ou plus récente**
- MongoDB, au choix :
  - **Local** : [MongoDB Community Server](https://www.mongodb.com/try/download/community)
  - **Cloud gratuit** : [MongoDB Atlas](https://www.mongodb.com/atlas) (aucune installation)

## Installation

```bash
npm install
cp .env.example .env      # Windows : copy .env.example .env
```

Ouvrez `.env` et vérifiez `MONGODB_URI` (par défaut : MongoDB local sur `mongodb://127.0.0.1:27017/student_management`).
Avec Atlas, collez votre lien de connexion à la place.

## Lancement

```bash
npm start          # production
npm run dev        # redémarre automatiquement à chaque modification
```

Ouvrez ensuite **http://localhost:3000** dans votre navigateur.

## API REST

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/students` | Liste (`search`, `course`, `sort`, `order`, `page`, `limit`) |
| GET | `/api/students/:id` | Détails d'un étudiant |
| POST | `/api/students` | Ajouter un étudiant |
| PUT | `/api/students/:id` | Modifier un étudiant |
| DELETE | `/api/students/:id` | Supprimer un étudiant |
| GET | `/api/students/stats` | Statistiques (total, filières, ajouts récents) |
| GET | `/api/students/courses` | Liste des filières |
| GET | `/api/health` | État du serveur et de la base |

Exemple de corps JSON pour `POST /api/students` :

```json
{
  "firstName": "Amira",
  "lastName": "Ben Salah",
  "email": "amira@example.com",
  "phone": "+216 22 123 456",
  "course": "Informatique",
  "level": 2,
  "dateOfBirth": "2002-05-14",
  "address": "Tunis"
}
```

Codes de réponse : `200` / `201` succès, `400` données invalides, `404` introuvable, `409` e-mail déjà utilisé.

## Tests

```bash
npm test
```

Les tests de l'API (création, lecture, modification, suppression, validation, doublons, recherche, pagination) utilisent une base MongoDB temporaire en mémoire : le premier lancement télécharge un binaire MongoDB, il faut donc être connecté à Internet.

Pour utiliser votre propre base **de test** à la place (elle sera vidée !) :

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/student_management_test npm test
```

## Structure du projet

```
student-management/
├── server.js            # Serveur Express, connexion MongoDB, gestion des erreurs
├── models/Student.js    # Schéma Mongoose et règles de validation
├── routes/students.js   # Routes CRUD de l'API
├── public/              # Interface web
│   ├── index.html
│   ├── style.css
│   └── app.js
├── tests/api.test.js    # Tests de l'API
├── .env.example         # Modèle de configuration
└── package.json
```

## Déploiement (optionnel)

1. Créez un cluster gratuit sur MongoDB Atlas et copiez le lien de connexion.
2. Poussez le projet sur GitHub.
3. Sur [Render](https://render.com) : *New → Web Service*, choisissez le dépôt, commande de build `npm install`, commande de démarrage `npm start`.
4. Ajoutez la variable d'environnement `MONGODB_URI` avec le lien Atlas.
