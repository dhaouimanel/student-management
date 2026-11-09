/*
 * Tests de l'API (étape 5 : tester les fonctionnalités)
 *
 * Lancer : npm test
 * Par défaut, une base MongoDB temporaire en mémoire est utilisée.
 * Pour utiliser votre propre base de TEST (elle sera vidée !), définissez :
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/student_management_test
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../server");
const Student = require("../models/Student");

let server;
let mongod;
let base;

const sample = (overrides = {}) => ({
  firstName: "Amira",
  lastName: "Ben Salah",
  email: "amira@example.com",
  phone: "+216 22 123 456",
  course: "Informatique",
  level: 2,
  dateOfBirth: "2002-05-14",
  address: "Tunis",
  ...overrides,
});

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  await mongoose.connect(uri);
  await Student.init();
  await Student.deleteMany({});

  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test("POST /students crée un étudiant (201)", async () => {
  const { status, body } = await request("/students", { method: "POST", body: JSON.stringify(sample()) });
  assert.equal(status, 201);
  assert.equal(body.email, "amira@example.com");
  assert.ok(body._id);
});

test("POST /students refuse un e-mail déjà utilisé (409)", async () => {
  const { status, body } = await request("/students", { method: "POST", body: JSON.stringify(sample()) });
  assert.equal(status, 409);
  assert.ok(body.errors.email);
});

test("POST /students refuse des données invalides (400)", async () => {
  const { status, body } = await request("/students", {
    method: "POST",
    body: JSON.stringify({ firstName: "A", email: "pas-un-email", level: 9 }),
  });
  assert.equal(status, 400);
  assert.ok(body.errors.firstName);
  assert.ok(body.errors.lastName);
  assert.ok(body.errors.email);
  assert.ok(body.errors.course);
  assert.ok(body.errors.level);
});

test("POST /students ignore les champs non autorisés", async () => {
  const { status, body } = await request("/students", {
    method: "POST",
    body: JSON.stringify(sample({ email: "karim@example.com", firstName: "Karim", _id: "000000000000000000000001", createdAt: "2000-01-01" })),
  });
  assert.equal(status, 201);
  assert.notEqual(body._id, "000000000000000000000001");
  assert.notEqual(body.createdAt.slice(0, 4), "2000");
});

test("GET /students liste les étudiants avec pagination", async () => {
  const { status, body } = await request("/students?limit=1&page=1&sort=firstName&order=asc");
  assert.equal(status, 200);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].firstName, "Amira");
  assert.equal(body.pagination.total, 2);
  assert.equal(body.pagination.pages, 2);
});

test("GET /students?search= filtre par nom (et neutralise les regex)", async () => {
  let result = await request("/students?search=karim");
  assert.equal(result.body.data.length, 1);

  result = await request("/students?search=" + encodeURIComponent(".*"));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 0);
});

test("GET /students?course= filtre par filière", async () => {
  await request("/students", {
    method: "POST",
    body: JSON.stringify(sample({ email: "lina@example.com", firstName: "Lina", course: "Gestion" })),
  });
  const { body } = await request("/students?course=Gestion");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].firstName, "Lina");
});

test("GET /students/courses et /students/stats", async () => {
  const courses = await request("/students/courses");
  assert.deepEqual(courses.body, ["Gestion", "Informatique"]);

  const stats = await request("/students/stats");
  assert.equal(stats.body.total, 3);
  assert.equal(stats.body.courses, 2);
  assert.equal(stats.body.recent, 3);
});

test("GET /students/:id renvoie les détails, 404 ou 400", async () => {
  const list = await request("/students?search=amira");
  const id = list.body.data[0]._id;

  const found = await request("/students/" + id);
  assert.equal(found.status, 200);
  assert.equal(found.body.lastName, "Ben Salah");

  const missing = await request("/students/64b7f0c2a1b2c3d4e5f60718");
  assert.equal(missing.status, 404);

  const invalid = await request("/students/abc");
  assert.equal(invalid.status, 400);
});

test("PUT /students/:id modifie un étudiant", async () => {
  const list = await request("/students?search=amira");
  const id = list.body.data[0]._id;

  const { status, body } = await request("/students/" + id, {
    method: "PUT",
    body: JSON.stringify({ level: 3, address: "Ariana" }),
  });
  assert.equal(status, 200);
  assert.equal(body.level, 3);
  assert.equal(body.address, "Ariana");
  assert.equal(body.firstName, "Amira"); // inchangé
});

test("PUT /students/:id refuse un e-mail déjà pris (409) et des données invalides (400)", async () => {
  const list = await request("/students?search=amira");
  const id = list.body.data[0]._id;

  const duplicate = await request("/students/" + id, {
    method: "PUT",
    body: JSON.stringify({ email: "karim@example.com" }),
  });
  assert.equal(duplicate.status, 409);

  const invalid = await request("/students/" + id, {
    method: "PUT",
    body: JSON.stringify({ level: 12 }),
  });
  assert.equal(invalid.status, 400);
});

test("DELETE /students/:id supprime un étudiant", async () => {
  const list = await request("/students?search=lina");
  const id = list.body.data[0]._id;

  const deleted = await request("/students/" + id, { method: "DELETE" });
  assert.equal(deleted.status, 200);

  const again = await request("/students/" + id, { method: "DELETE" });
  assert.equal(again.status, 404);

  const stats = await request("/students/stats");
  assert.equal(stats.body.total, 2);
});

test("JSON invalide et route inconnue", async () => {
  const bad = await fetch(base + "/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{pas du json",
  });
  assert.equal(bad.status, 400);

  const unknown = await request("/inconnu");
  assert.equal(unknown.status, 404);
});
