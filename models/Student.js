const mongoose = require("mongoose");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[+\d][\d\s().-]{5,19}$/;

const studentSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Le prénom est obligatoire"],
      trim: true,
      minlength: [2, "Le prénom doit contenir au moins 2 caractères"],
      maxlength: [50, "Le prénom ne doit pas dépasser 50 caractères"],
    },
    lastName: {
      type: String,
      required: [true, "Le nom est obligatoire"],
      trim: true,
      minlength: [2, "Le nom doit contenir au moins 2 caractères"],
      maxlength: [50, "Le nom ne doit pas dépasser 50 caractères"],
    },
    email: {
      type: String,
      required: [true, "L'e-mail est obligatoire"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [EMAIL_REGEX, "Adresse e-mail invalide"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      match: [PHONE_REGEX, "Numéro de téléphone invalide"],
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: (value) => !value || value <= new Date(),
        message: "La date de naissance ne peut pas être dans le futur",
      },
    },
    course: {
      type: String,
      required: [true, "La filière est obligatoire"],
      trim: true,
      maxlength: [80, "La filière ne doit pas dépasser 80 caractères"],
    },
    level: {
      type: Number,
      required: [true, "Le niveau est obligatoire"],
      min: [1, "Le niveau doit être compris entre 1 et 5"],
      max: [5, "Le niveau doit être compris entre 1 et 5"],
      default: 1,
    },
    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "L'adresse ne doit pas dépasser 200 caractères"],
    },
  },
  {
    timestamps: true, // createdAt et updatedAt
    versionKey: false,
  }
);

studentSchema.index({ firstName: 1, lastName: 1 });
studentSchema.index({ course: 1 });

module.exports = mongoose.model("Student", studentSchema);
