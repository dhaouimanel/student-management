/* =========================================================
   Gestion des étudiants : interface (JavaScript pur)
   ========================================================= */
(function () {
  "use strict";

  const API = "/api/students";
  const PAGE_SIZE = 8;

  const $ = (selector) => document.querySelector(selector);

  /* ---------- Éléments ---------- */
  const body = $("#studentsBody");
  const stateBox = $("#stateBox");
  const pagination = $("#pagination");
  const pageInfo = $("#pageInfo");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");
  const searchInput = $("#search");
  const courseFilter = $("#courseFilter");
  const sortSelect = $("#sortSelect");

  const formDialog = $("#formDialog");
  const form = $("#studentForm");
  const formTitle = $("#formTitle");
  const formError = $("#formError");
  const saveBtn = $("#saveBtn");

  const detailDialog = $("#detailDialog");
  const deleteDialog = $("#deleteDialog");
  const toast = $("#toast");

  /* ---------- État ---------- */
  const state = { page: 1, search: "", course: "", sort: "createdAt", order: "desc" };
  let editingId = null; // null = ajout, sinon identifiant de l'étudiant modifié
  let detailStudent = null;
  let studentToDelete = null;
  let toastTimer = null;

  /* ---------- Utilitaires ---------- */
  async function api(path = "", options = {}) {
    const response = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      /* réponse sans JSON */
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || "Erreur du serveur");
      error.status = response.status;
      error.errors = (data && data.errors) || {};
      throw error;
    }
    return data;
  }

  function showToast(message, type) {
    toast.textContent = message;
    toast.className = "toast " + (type || "");
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 3500);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const initials = (s) => ((s.firstName[0] || "") + (s.lastName[0] || "")).toUpperCase();
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "–");
  const levelLabel = (n) => (n === 1 ? "1ère année" : n + "ème année");

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /* ---------- Chargement des données ---------- */
  async function loadStats() {
    try {
      const stats = await api("/stats");
      $("#statTotal").textContent = stats.total;
      $("#statCourses").textContent = stats.courses;
      $("#statRecent").textContent = stats.recent;
    } catch (e) {
      /* les statistiques ne sont pas critiques */
    }
  }

  async function loadCourses() {
    try {
      const courses = await api("/courses");

      const current = courseFilter.value;
      courseFilter.replaceChildren(new Option("Toutes les filières", ""));
      $("#courseList").replaceChildren();

      courses.forEach((course) => {
        courseFilter.append(new Option(course, course));
        const option = document.createElement("option");
        option.value = course;
        $("#courseList").append(option);
      });

      // Conserve le filtre actif s'il existe encore
      if (courses.includes(current)) {
        courseFilter.value = current;
      } else if (current) {
        state.course = "";
      }
    } catch (e) {
      /* non critique */
    }
  }

  async function loadStudents() {
    const params = new URLSearchParams({
      page: state.page,
      limit: PAGE_SIZE,
      sort: state.sort,
      order: state.order,
    });
    if (state.search) params.set("search", state.search);
    if (state.course) params.set("course", state.course);

    try {
      const { data, pagination: info } = await api("?" + params.toString());

      // Dernière page devenue vide (après une suppression) : on recule d'une page
      if (data.length === 0 && state.page > 1) {
        state.page -= 1;
        return loadStudents();
      }

      renderTable(data);
      renderPagination(info);
    } catch (error) {
      body.replaceChildren();
      pagination.hidden = true;
      showState("Impossible de charger les étudiants : " + error.message, true);
    }
  }

  function refreshAll() {
    return Promise.all([loadStudents(), loadStats(), loadCourses()]);
  }

  /* ---------- Affichage ---------- */
  function showState(message, isError) {
    stateBox.textContent = message;
    stateBox.className = "state" + (isError ? " error-state" : "");
    stateBox.hidden = false;
  }

  function renderTable(students) {
    body.replaceChildren();

    if (students.length === 0) {
      const filtered = state.search || state.course;
      showState(filtered ? "Aucun étudiant ne correspond à votre recherche." : "Aucun étudiant pour le moment. Cliquez sur « Ajouter un étudiant » pour commencer.");
      return;
    }
    stateBox.hidden = true;

    students.forEach((student) => {
      const row = el("tr");

      // Colonne : étudiant
      const nameCell = el("td");
      const person = el("div", "person");
      person.append(el("div", "avatar", initials(student)));
      const names = el("div");
      names.append(el("div", "person-name", student.firstName + " " + student.lastName));
      person.append(names);
      nameCell.append(person);

      // Autres colonnes
      const emailCell = el("td", "", student.email);
      const courseCell = el("td", "", student.course);
      const levelCell = el("td");
      levelCell.append(el("span", "badge", levelLabel(student.level)));

      // Actions
      const actions = el("td", "actions");
      const viewBtn = el("button", "icon-btn", "Voir");
      const editBtn = el("button", "icon-btn", "Modifier");
      const delBtn = el("button", "icon-btn danger", "Supprimer");
      [viewBtn, editBtn, delBtn].forEach((b) => (b.type = "button"));
      viewBtn.addEventListener("click", () => openDetails(student));
      editBtn.addEventListener("click", () => openForm(student));
      delBtn.addEventListener("click", () => openDelete(student));
      actions.append(viewBtn, editBtn, delBtn);

      row.append(nameCell, emailCell, courseCell, levelCell, actions);
      body.append(row);
    });
  }

  function renderPagination(info) {
    pagination.hidden = info.pages <= 1;
    pageInfo.textContent = "Page " + info.page + " sur " + info.pages + " (" + info.total + " étudiant" + (info.total > 1 ? "s" : "") + ")";
    prevBtn.disabled = info.page <= 1;
    nextBtn.disabled = info.page >= info.pages;
  }

  /* ---------- Détails ---------- */
  function openDetails(student) {
    detailStudent = student;
    $("#detailAvatar").textContent = initials(student);
    $("#detailName").textContent = student.firstName + " " + student.lastName;
    $("#detailCourse").textContent = student.course + " · " + levelLabel(student.level);

    const list = $("#detailList");
    list.replaceChildren();
    const rows = [
      ["E-mail", student.email],
      ["Téléphone", student.phone || "–"],
      ["Date de naissance", formatDate(student.dateOfBirth)],
      ["Adresse", student.address || "–"],
      ["Inscrit le", formatDate(student.createdAt)],
      ["Dernière modification", formatDate(student.updatedAt)],
    ];
    rows.forEach(([label, value]) => {
      list.append(el("dt", "", label), el("dd", "", value));
    });

    detailDialog.showModal();
  }

  /* ---------- Formulaire (ajout / modification) ---------- */
  function clearFormErrors() {
    formError.hidden = true;
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
    form.querySelectorAll("[data-error-for]").forEach((s) => (s.textContent = ""));
  }

  function setFieldError(name, message) {
    const small = form.querySelector('[data-error-for="' + name + '"]');
    if (!small) return false;
    small.textContent = message;
    small.closest(".field").classList.add("invalid");
    return true;
  }

  function openForm(student) {
    clearFormErrors();
    form.reset();
    editingId = student ? student._id : null;
    formTitle.textContent = student ? "Modifier l'étudiant" : "Ajouter un étudiant";

    if (student) {
      ["firstName", "lastName", "email", "phone", "course", "address"].forEach((name) => {
        form.elements[name].value = student[name] || "";
      });
      form.elements.level.value = String(student.level);
      form.elements.dateOfBirth.value = student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "";
    }

    formDialog.showModal();
    form.elements.firstName.focus();
  }

  // Vérification côté client avant l'envoi
  function validateForm() {
    clearFormErrors();
    let valid = true;
    const value = (name) => form.elements[name].value.trim();

    if (value("firstName").length < 2) { setFieldError("firstName", "Le prénom doit contenir au moins 2 caractères"); valid = false; }
    if (value("lastName").length < 2) { setFieldError("lastName", "Le nom doit contenir au moins 2 caractères"); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value("email"))) { setFieldError("email", "Adresse e-mail invalide"); valid = false; }
    if (value("phone") && !/^[+\d][\d\s().-]{5,19}$/.test(value("phone"))) { setFieldError("phone", "Numéro de téléphone invalide"); valid = false; }
    if (!value("course")) { setFieldError("course", "La filière est obligatoire"); valid = false; }
    if (value("dateOfBirth") && new Date(value("dateOfBirth")) > new Date()) { setFieldError("dateOfBirth", "La date ne peut pas être dans le futur"); valid = false; }

    return valid;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      firstName: form.elements.firstName.value.trim(),
      lastName: form.elements.lastName.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      course: form.elements.course.value.trim(),
      level: Number(form.elements.level.value),
      dateOfBirth: form.elements.dateOfBirth.value || null,
      address: form.elements.address.value.trim(),
    };

    saveBtn.disabled = true;
    try {
      if (editingId) {
        await api("/" + editingId, { method: "PUT", body: JSON.stringify(payload) });
        showToast("Étudiant modifié avec succès", "success");
      } else {
        await api("", { method: "POST", body: JSON.stringify(payload) });
        showToast("Étudiant ajouté avec succès", "success");
        state.page = 1;
      }
      formDialog.close();
      await refreshAll();
    } catch (error) {
      // Messages du serveur : un par champ si possible
      let shown = false;
      Object.entries(error.errors || {}).forEach(([field, message]) => {
        if (setFieldError(field, message)) shown = true;
      });
      if (!shown) {
        formError.textContent = error.message;
        formError.hidden = false;
      }
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* ---------- Suppression ---------- */
  function openDelete(student) {
    studentToDelete = student;
    $("#deleteText").textContent =
      "Vous êtes sur le point de supprimer " + student.firstName + " " + student.lastName + ". Cette action est irréversible.";
    deleteDialog.showModal();
  }

  $("#confirmDelete").addEventListener("click", async () => {
    if (!studentToDelete) return;
    const button = $("#confirmDelete");
    button.disabled = true;
    try {
      await api("/" + studentToDelete._id, { method: "DELETE" });
      deleteDialog.close();
      showToast("Étudiant supprimé", "success");
      await refreshAll();
    } catch (error) {
      deleteDialog.close();
      showToast(error.message, "error");
      await refreshAll(); // l'étudiant a peut-être déjà été supprimé ailleurs
    } finally {
      button.disabled = false;
      studentToDelete = null;
    }
  });

  /* ---------- Événements ---------- */
  $("#addBtn").addEventListener("click", () => openForm(null));
  $("#cancelForm").addEventListener("click", () => formDialog.close());
  $("#closeDetail").addEventListener("click", () => detailDialog.close());
  $("#cancelDelete").addEventListener("click", () => deleteDialog.close());
  $("#editFromDetail").addEventListener("click", () => {
    const student = detailStudent;
    detailDialog.close();
    openForm(student);
  });

  // Fermer une boîte de dialogue en cliquant sur le fond sombre
  [formDialog, detailDialog, deleteDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  searchInput.addEventListener(
    "input",
    debounce(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      loadStudents();
    }, 300)
  );

  courseFilter.addEventListener("change", () => {
    state.course = courseFilter.value;
    state.page = 1;
    loadStudents();
  });

  sortSelect.addEventListener("change", () => {
    const [sort, order] = sortSelect.value.split(":");
    state.sort = sort;
    state.order = order;
    state.page = 1;
    loadStudents();
  });

  prevBtn.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadStudents();
    }
  });
  nextBtn.addEventListener("click", () => {
    state.page += 1;
    loadStudents();
  });

  /* ---------- Démarrage ---------- */
  refreshAll();
})();
