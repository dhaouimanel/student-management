const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");

const router = express.Router();

// Champs que le client a le droit d'envoyer (évite d'écraser _id, createdAt, etc.)
const ALLOWED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "dateOfBirth",
  "course",
  "level",
  "address",
];

// Champs sur lesquels on autorise le tri
const SORTABLE_FIELDS = ["createdAt", "firstName", "lastName", "course", "level"];

const pickAllowed = (body = {}) =>
  ALLOWED_FIELDS.reduce((data, field) => {
    if (body[field] !== undefined) data[field] = body[field];
    return data;
  }, {});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asString = (value) => (typeof value === "string" ? value.trim() : "");

// Vérifie l'identifiant avant de requêter la base
const validateId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Identifiant invalide" });
  }
  next();
};

// Permet d'utiliser async/await sans try/catch dans chaque route
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------
   GET /api/students/stats : chiffres du tableau de bord
------------------------------------------------------------------- */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, courses, recent] = await Promise.all([
      Student.countDocuments(),
      Student.distinct("course"),
      Student.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);
    res.json({ total, courses: courses.length, recent });
  })
);

/* ------------------------------------------------------------------
   GET /api/students/courses : liste des filières existantes
------------------------------------------------------------------- */
router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const courses = await Student.distinct("course");
    courses.sort((a, b) => a.localeCompare(b, "fr"));
    res.json(courses);
  })
);

/* ------------------------------------------------------------------
   GET /api/students : liste avec recherche, filtre, tri, pagination
   ?search=ali&course=Informatique&sort=lastName&order=asc&page=1&limit=10
------------------------------------------------------------------- */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = asString(req.query.search);
    const course = asString(req.query.course);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const sortField = SORTABLE_FIELDS.includes(req.query.sort) ? req.query.sort : "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const filter = {};
    if (course) filter.course = course;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
    }

    const [data, total] = await Promise.all([
      Student.find(filter)
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  })
);

/* ------------------------------------------------------------------
   GET /api/students/:id : détails d'un étudiant
------------------------------------------------------------------- */
router.get(
  "/:id",
  validateId,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Étudiant introuvable" });
    res.json(student);
  })
);

/* ------------------------------------------------------------------
   POST /api/students : ajouter un étudiant
------------------------------------------------------------------- */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const student = await Student.create(pickAllowed(req.body));
    res.status(201).json(student);
  })
);

/* ------------------------------------------------------------------
   PUT /api/students/:id : modifier un étudiant
------------------------------------------------------------------- */
router.put(
  "/:id",
  validateId,
  asyncHandler(async (req, res) => {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: pickAllowed(req.body) },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ message: "Étudiant introuvable" });
    res.json(student);
  })
);

/* ------------------------------------------------------------------
   DELETE /api/students/:id : supprimer un étudiant
------------------------------------------------------------------- */
router.delete(
  "/:id",
  validateId,
  asyncHandler(async (req, res) => {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Étudiant introuvable" });
    res.json({ message: "Étudiant supprimé avec succès", id: student._id });
  })
);

module.exports = router;
