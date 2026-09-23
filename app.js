// SkillBridge — shared helpers used by every page.
//   initShell()      -> highlights the current sidebar link, shows who is signed in,
//                       and fills the top-right actions (Log in / Sign up or Log out).
//   currentUser()    -> resolves once with the signed-in user (or null).
//   requireAuth()    -> like currentUser() but sends guests to login.html first.
//   formatPrice()    -> 0 -> "Free", 8000 -> "₦8,000"
//   courseCardHTML() -> the catalog card markup for one course.
//   cart / enrollment helpers -> read and write a user's course lists in the database.
//
// Database shape:
//   users/{uid}/profile            -> { name, email, bio, createdAt, photoURL? }
//   users/{uid}/cart/{courseId}    -> timestamp the course was added
//   users/{uid}/enrollments/{id}   -> { enrolledAt, completedLessons: { "0": true, ... } }
//   courses/{id}                   -> a course (see courses.js SEED_COURSES for the shape) — admin-writable
//   teacherApplications/{uid}/{id} -> { courseTitle, category, pitch, applicantEmail, submittedAt, status }
//   purchases/{uid}/{ref}          -> { courseIds, amount, buyerEmail, paidAt }
//   courseReviews/{courseId}/{uid} -> { rating, comment, authorName, createdAt } — public

import {
  auth, db, ref, push, get, set, update, remove, onAuthStateChanged, signOut, updateProfile, onValue,
  sendEmailVerification, reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteUser,
} from "./config.js";
import { CATEGORY_THEME } from "./courses.js";

// The one account allowed to manage the catalog and review teach applications. Enforced both
// here (hides admin UI from everyone else) and in the Firebase rules (so it can't be
// bypassed by editing the page) — see the rules block noted in admin.html.
export const ADMIN_EMAIL = "sulaimonhikmat668@gmail.com";
export const isAdmin = (user) => !!user && user.email === ADMIN_EMAIL;

export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

export async function requireAuth() {
  const user = await currentUser();
  if (!user) {
    const here = location.pathname.split("/").pop() + location.search;
    location.href = `login.html?next=${encodeURIComponent(here)}`;
    // Return a promise that never resolves so the calling page stops here.
    return new Promise(() => {});
  }
  return user;
}

export const formatPrice = (price) =>
  price === 0 ? "Free" : `₦${price.toLocaleString("en-NG")}`;

export function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// A gradient-and-icon stand-in cover for a course, keyed off its category theme (see
// CATEGORY_THEME in courses.js). `sizeClass` lets callers ask for the bigger detail-page
// banner variant instead of the small card thumbnail.
export function courseThumbHTML(course, sizeClass = "course-card__thumb") {
  const theme = CATEGORY_THEME[course.category] || { gradient: "linear-gradient(135deg, var(--ink), var(--ink-soft))", icon: "📚" };
  return `
    <div class="${sizeClass}" style="background: ${theme.gradient};">
      <span class="course-thumb__icon">${theme.icon}</span>
      <span class="course-thumb__letter">${escapeHTML(course.title.charAt(0).toUpperCase())}</span>
    </div>`;
}

export function courseCardHTML(course) {
  const priceClass = course.price === 0 ? "course-card__price is-free" : "course-card__price";
  return `
    <a class="course-card" href="course-detail.html?id=${course.id}">
      ${courseThumbHTML(course)}
      <span class="course-card__category">${escapeHTML(course.category)}</span>
      <div class="course-card__body">
        <span class="course-card__title">${escapeHTML(course.title)}</span>
        <span class="course-card__instructor">${escapeHTML(course.instructor)}</span>
        <div class="course-card__meta">
          <span class="course-card__rating">★ ${course.rating.toFixed(1)}</span>
          <span class="${priceClass}">${formatPrice(course.price)}</span>
        </div>
      </div>
    </a>`;
}

// ---- Course catalog ----
// Lives in Firebase (courses/{id}), not the old static courses.js file, so admin.html can
// manage it. Reads are public; writes are restricted to ADMIN_EMAIL in the database rules.
// coursesCache holds the last-loaded list so getCourseCached() can be a plain synchronous
// lookup everywhere else — call loadCourses() once per page before using it.

let coursesCache = null;

export async function loadCourses() {
  if (coursesCache) return coursesCache;
  try {
    const snap = await get(ref(db, "courses"));
    coursesCache = snap.exists() ? Object.values(snap.val()) : [];
  } catch (err) {
    // A misconfigured rule or a network hiccup shouldn't take the whole page down — every
    // caller already treats an empty list as "nothing to show" rather than crashing, so
    // that's the safe fallback here too. The real reason still goes to the console.
    console.error("Could not load courses:", err);
    coursesCache = [];
  }
  return coursesCache;
}

export function getCourseCached(id) {
  return coursesCache?.find((c) => c.id === id) || null;
}

// Live version for admin.html, so adding/editing/deleting a course updates the list on
// screen immediately. Fires right away with the current data, then again on every change.
export function watchCourses(callback) {
  return onValue(ref(db, "courses"), (snap) => {
    coursesCache = snap.exists() ? Object.values(snap.val()) : [];
    callback(coursesCache);
  });
}

export async function saveCourse(courseId, data) {
  await set(ref(db, `courses/${courseId}`), data);
}

export async function deleteCourse(courseId) {
  await remove(ref(db, `courses/${courseId}`));
}

// The next cNNN id after whatever's already there, e.g. c001..c016 exist -> "c017".
export function nextCourseId(existingCourses) {
  const nums = existingCourses
    .map((c) => parseInt(String(c.id).replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `c${String(next).padStart(3, "0")}`;
}

// ---- Cart ----

export async function isInCart(uid, courseId) {
  const snap = await get(ref(db, `users/${uid}/cart/${courseId}`));
  return snap.exists();
}

export async function addToCart(uid, courseId) {
  await set(ref(db, `users/${uid}/cart/${courseId}`), Date.now());
}

export async function removeFromCart(uid, courseId) {
  await remove(ref(db, `users/${uid}/cart/${courseId}`));
}

export async function getCartCourseIds(uid) {
  const snap = await get(ref(db, `users/${uid}/cart`));
  return snap.exists() ? Object.keys(snap.val()) : [];
}

// ---- Enrollments ----

export async function isEnrolled(uid, courseId) {
  const snap = await get(ref(db, `users/${uid}/enrollments/${courseId}`));
  return snap.exists();
}

// Full enrollment record for one course — { enrolledAt, completedLessons } — or null.
export async function getEnrollment(uid, courseId) {
  const snap = await get(ref(db, `users/${uid}/enrollments/${courseId}`));
  return snap.exists() ? snap.val() : null;
}

// Enrolls in one course and clears it from the cart, if it was there.
export async function enrollInCourse(uid, courseId) {
  await set(ref(db, `users/${uid}/enrollments/${courseId}`), {
    enrolledAt: Date.now(),
    completedLessons: {},
  });
  await remove(ref(db, `users/${uid}/cart/${courseId}`));
}

export async function getEnrollments(uid) {
  const snap = await get(ref(db, `users/${uid}/enrollments`));
  return snap.exists() ? snap.val() : {};
}

// Marks one lesson done or not-done for a course the user is already enrolled in.
export async function setLessonComplete(uid, courseId, lessonIndex, done) {
  const lessonRef = ref(db, `users/${uid}/enrollments/${courseId}/completedLessons/${lessonIndex}`);
  if (done) await set(lessonRef, true);
  else await remove(lessonRef);
}

// 0-100. completedLessons is the raw { "0": true, "2": true, ... } map from the database.
export function completionPercent(course, completedLessons) {
  const total = course.lessons.length;
  if (!total) return 0;
  const done = completedLessons ? Object.values(completedLessons).filter(Boolean).length : 0;
  return Math.round((done / total) * 100);
}

// ---- Purchases ----
// A record of each Paystack payment. This does NOT confirm the payment server-side — see
// the note in cart.html for what that would take. Lives at the TOP level — purchases/{uid}/
// {ref} — same reasoning as teacherApplications: it lets the admin Sales tab read every
// purchase across every buyer in one call, instead of needing to scan every user's data.

export async function recordPurchase(uid, { reference, courseIds, amount }) {
  await set(ref(db, `purchases/${uid}/${reference}`), {
    courseIds,
    amount,
    buyerEmail: auth.currentUser?.email || "",
    paidAt: Date.now(),
  });
}

export async function getPurchases(uid) {
  const snap = await get(ref(db, `purchases/${uid}`));
  return snap.exists() ? snap.val() : {};
}

// ---- Admin: sales ----

// Every purchase from every buyer, flattened into one list, newest first — for admin.html
// only. Only ADMIN_EMAIL can actually read purchases at this top level; the database rules
// block anyone else from calling this successfully.
export function watchAllPurchases(callback) {
  return onValue(ref(db, "purchases"), (snap) => {
    const all = [];
    snap.forEach((uidSnap) => {
      uidSnap.forEach((purchaseSnap) => {
        all.push({ uid: uidSnap.key, reference: purchaseSnap.key, ...purchaseSnap.val() });
      });
    });
    all.sort((a, b) => b.paidAt - a.paidAt);
    callback(all);
  });
}

// ---- Profile ----

export async function getProfile(uid) {
  const snap = await get(ref(db, `users/${uid}/profile`));
  return snap.exists() ? snap.val() : null;
}

export async function saveProfile(uid, { name, bio }) {
  await update(ref(db, `users/${uid}/profile`), { name, bio });
}

// Keeps the Firebase Auth displayName (what initShell reads) in sync with the profile record.
export async function updateProfileName(name) {
  if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
}

// Saves a photo URL (from Cloudinary — see profile.html) to the profile record, and mirrors
// it onto the Firebase Auth photoURL too, the same pattern updateProfileName uses for names.
export async function updateProfilePhoto(uid, photoURL) {
  await update(ref(db, `users/${uid}/profile`), { photoURL });
  if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL });
}

// ---- Account settings ----
// Changing a password and deleting an account are both "sensitive" operations — Firebase
// requires the user to have signed in recently, so both re-check the password first.

async function reauthenticate(password) {
  const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
  await reauthenticateWithCredential(auth.currentUser, credential);
}

export async function changePassword(currentPassword, newPassword) {
  await reauthenticate(currentPassword);
  await updatePassword(auth.currentUser, newPassword);
}

export async function resendVerificationEmail() {
  await sendEmailVerification(auth.currentUser);
}

// Firebase only knows the *current* verified status after a reload — it doesn't push it
// live when the user clicks the link in their email, so this needs to be called explicitly
// (e.g. from a "I've verified — refresh" button) to pick up a change.
export async function refreshEmailVerified() {
  await auth.currentUser.reload();
  return auth.currentUser.emailVerified;
}

// Deletes the user's own data (cart, enrollments, purchases, profile, teacher application)
// and then their sign-in account. Any course reviews they wrote are left in place — nothing
// here can safely find every review across every course to remove them, and it's normal
// elsewhere too for a review to outlive the account that wrote it.
export async function deleteAccount(currentPassword) {
  await reauthenticate(currentPassword);
  const uid = auth.currentUser.uid;
  await remove(ref(db, `users/${uid}`));
  await deleteUser(auth.currentUser);
}

// ---- Teach applications ----
// Lives at the TOP level now — teacherApplications/{uid}/{appId} — not nested under
// users/{uid} like it first was. A single applicant still only ever sees their own uid's
// subtree, but this shape also lets the admin page read the *entire* collection in one
// call to build a review queue, instead of needing to scan every user's data to find who
// has applications (which Realtime Database can't do without a full-tree read).
//
// Applications reviewed by hand in admin.html now, with real Approve/Reject buttons instead
// of hand-editing a status string in the Firebase console.

// Words someone reviewing by hand might reasonably type, normalized to the three real
// statuses. Kept forgiving on purpose — see the note in teach.html's git history for why.
export const STATUS_LABEL = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not selected this time",
};
export function normalizeStatus(raw) {
  const s = (raw || "pending").toString().trim().toLowerCase();
  if (["approved", "approve", "accepted", "accept"].includes(s)) return "approved";
  if (["rejected", "reject", "denied", "deny", "declined", "decline"].includes(s)) return "rejected";
  return "pending";
}

// Fires immediately with the current list, then again on every change. Callback receives an
// array of [appId, data] pairs, newest first. Returns the unsubscribe function.
export function watchTeacherApplications(uid, callback) {
  return onValue(ref(db, `teacherApplications/${uid}`), (snap) => {
    const entries = Object.entries(snap.val() || {});
    entries.sort(([, a], [, b]) => b.submittedAt - a.submittedAt);
    callback(entries);
  });
}

export async function addTeacherApplication(uid, { courseTitle, category, pitch }) {
  const newRef = push(ref(db, `teacherApplications/${uid}`));
  await set(newRef, {
    courseTitle, category, pitch,
    applicantEmail: auth.currentUser?.email || "",
    submittedAt: Date.now(),
    status: "pending",
  });
}

// Editing an existing proposal always resets it to "pending" — if it had been rejected,
// this is what puts it back in front of you for another look.
export async function updateTeacherApplication(uid, appId, { courseTitle, category, pitch }) {
  await update(ref(db, `teacherApplications/${uid}/${appId}`), {
    courseTitle, category, pitch, submittedAt: Date.now(), status: "pending",
  });
}

// ---- Admin: teach applications ----

// Every application from every applicant, flattened into one list — for admin.html only.
// Only ADMIN_EMAIL can actually read teacherApplications at this top level; the database
// rules block anyone else from calling this successfully.
export function watchAllTeacherApplications(callback) {
  return onValue(ref(db, "teacherApplications"), (snap) => {
    const all = [];
    snap.forEach((uidSnap) => {
      uidSnap.forEach((appSnap) => {
        all.push({ uid: uidSnap.key, appId: appSnap.key, ...appSnap.val() });
      });
    });
    all.sort((a, b) => b.submittedAt - a.submittedAt);
    callback(all);
  });
}

export async function setApplicationStatus(uid, appId, status) {
  await update(ref(db, `teacherApplications/${uid}/${appId}`), { status });
}

// ---- Reviews ----
// Public — courseReviews/{courseId}/{uid} -> { rating, comment, authorName, createdAt }.
// Keyed by reviewer uid, so writing again just edits that person's own review. Database
// rules should only allow writing your own uid, and only if you're enrolled in that course.

export async function getReviews(courseId) {
  const snap = await get(ref(db, `courseReviews/${courseId}`));
  return snap.exists() ? snap.val() : {};
}

export async function saveReview(uid, courseId, { rating, comment, authorName }) {
  await set(ref(db, `courseReviews/${courseId}/${uid}`), {
    rating,
    comment,
    authorName,
    createdAt: Date.now(),
  });
}

// Real average + count from actual reviews, falling back to the course's seed rating
// (from courses.js) when nobody's reviewed it yet, so a new course isn't shown as unrated.
export function summarizeReviews(reviews, fallbackRating) {
  const list = Object.values(reviews || {});
  if (list.length === 0) return { average: fallbackRating, count: 0, isReal: false };
  const average = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
  return { average, count: list.length, isReal: true };
}

// A small "back" link most pages put above their title. Goes to wherever the visitor
// actually came from (browser history), rather than a fixed page — the sidebar already
// covers "go to a specific page," this covers "go back to where I was." Falls back to the
// catalog if there's no same-site page to return to (e.g. this page opened in a new tab).
export function backLinkHTML() {
  return `<button type="button" class="back-link" id="back-link-btn">← Back</button>`;
}
export function wireBackLink() {
  document.getElementById("back-link-btn")?.addEventListener("click", () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.href = "catalog.html";
  });
}

// Keeps only one cart listener alive at a time across initShell() calls (e.g. after a
// profile save re-runs initShell on the same page).
let stopCartWatch = null;

export function initShell() {
  // Highlight the sidebar link for the page we are on.
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sidebar__link").forEach((link) => {
    const target = link.getAttribute("href");
    const isHome = page === "index.html" && target === "catalog.html";
    link.classList.toggle("is-active", target === page || isHome);
  });

  setUpMobileMenu();
  setUpTopbarSearch();

  const footer = document.querySelector(".sidebar__footer");
  const actions = document.getElementById("topbar-actions");

  onAuthStateChanged(auth, (user) => {
    if (stopCartWatch) {
      stopCartWatch();
      stopCartWatch = null;
    }

    if (user) {
      const name = user.displayName || user.email.split("@")[0];
      if (footer) footer.textContent = `Signed in as ${name}`;

      // The admin account gets a trimmed-down sidebar — Catalog (to see the live site),
      // Profile, and Admin — instead of the shopping/learning links (Dashboard, Cart,
      // Teach) that don't make sense for the one account running the platform. Everyone
      // else's sidebar is completely unchanged.
      const nav = document.querySelector(".sidebar__nav");
      if (nav && isAdmin(user)) {
        ["dashboard.html", "cart.html", "teach.html"].forEach((href) => {
          nav.querySelector(`a[href="${href}"]`)?.style.setProperty("display", "none");
        });
        if (!nav.querySelector('a[href="admin.html"]')) {
          const link = document.createElement("a");
          link.className = "sidebar__link";
          link.href = "admin.html";
          link.innerHTML = `<span class="sidebar__icon">⚙</span> Admin`;
          if (location.pathname.split("/").pop() === "admin.html") link.classList.add("is-active");
          nav.appendChild(link);
        }
      }

      if (actions) {
        actions.innerHTML = `
          <a class="topbar__icon-btn" href="cart.html" aria-label="Cart">
            ⛁<span class="cart-badge" id="cart-badge" hidden>0</span>
          </a>
          <a class="topbar__icon-btn" href="profile.html" aria-label="Profile">◐</a>
          <button class="btn btn--outline" id="logout-btn" style="padding: 8px 16px;">Log out</button>`;
        actions.querySelector("#logout-btn").addEventListener("click", async () => {
          await signOut(auth);
          location.href = "index.html";
        });

        // Live count, not a one-time read: adding/removing a cart item on this same page
        // (course-detail.html, cart.html) updates the badge immediately, no reload needed.
        const cartLink = actions.querySelector('a[href="cart.html"]');
        const badge = actions.querySelector("#cart-badge");
        stopCartWatch = onValue(ref(db, `users/${user.uid}/cart`), (snap) => {
          const count = snap.exists() ? Object.keys(snap.val()).length : 0;
          badge.hidden = count === 0;
          badge.textContent = count > 9 ? "9+" : String(count);
          cartLink.setAttribute("aria-label", count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart");
        });
      }
    } else {
      if (footer) footer.textContent = "Browsing as guest";
      if (actions) {
        actions.innerHTML = `
          <a class="btn btn--outline" href="login.html#login" style="padding: 8px 16px;">Log in</a>
          <a class="btn btn--gold" href="login.html" style="padding: 8px 16px;">Sign up</a>`;
      }
    }
  });
}

// Injects the hamburger button and backdrop needed for the mobile slide-in sidebar, once
// per page. Below 600px wide, the sidebar is otherwise unreachable without this.
function setUpMobileMenu() {
  if (document.getElementById("menu-btn")) return; // already set up (initShell can re-run)

  const topbar = document.querySelector(".topbar");
  const sidebar = document.querySelector(".sidebar");
  const shell = document.querySelector(".app-shell");
  if (!topbar || !sidebar || !shell) return;

  const menuBtn = document.createElement("button");
  menuBtn.id = "menu-btn";
  menuBtn.className = "topbar__menu-btn";
  menuBtn.setAttribute("aria-label", "Open menu");
  menuBtn.textContent = "☰";
  topbar.prepend(menuBtn);

  const backdrop = document.createElement("div");
  backdrop.id = "sidebar-backdrop";
  backdrop.className = "sidebar-backdrop";
  shell.appendChild(backdrop);

  const closeMenu = () => {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  };
  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    backdrop.classList.toggle("is-open");
  });
  backdrop.addEventListener("click", closeMenu);
  sidebar.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
}

// Pages other than catalog.html (which filters live) and index.html (which has its own
// search form) just have a plain topbar search box. Pressing Enter in it should still go
// somewhere, so it hands off to the catalog with the typed query.
function setUpTopbarSearch() {
  const input = document.querySelector(".topbar__search");
  if (!input || input.id === "search" || input.closest("form")) return;

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = input.value.trim();
    location.href = q ? `catalog.html?q=${encodeURIComponent(q)}` : "catalog.html";
  });
}
