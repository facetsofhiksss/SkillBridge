import { auth, db} from "./script.js";
import {getAuth, createUserWithEmailAndPassword,signInWithPopup,GoogleAuthAProvider, updateProfile } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { showFieldError, clearAllErrors, isValidEmail } from "./script.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { ref, push, onValue, remove, set } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";


// const FIELDS = [
//   ["email", "emailError"],
//   ["username", "usernameError"],
//   ["password", "passwordError"],
// ];

// function validateSignup(email, username, password) {
//   clearAllErrors(FIELDS);
//   let isValid = true;

//   if (!email) {
//     showFieldError("email", "emailError", "Email is required.");
//     isValid = false;
//   } else if (!isValidEmail(email)) {
//     showFieldError("email", "emailError", "Enter a valid email address.");
//     isValid = false;
//   }

//   if (!username) {
//     showFieldError("username", "usernameError", "Username is required.");
//     isValid = false;
//   } else if (username.length < 3) {
//     showFieldError("username", "usernameError", "Username must be at least 3 characters.");
//     isValid = false;
//   }

//   if (!password) {
//     showFieldError("password", "passwordError", "Password is required.");
//     isValid = false;
//   } else if (password.length < 6) {
//     showFieldError("password", "passwordError", "Password must be at least 6 characters.");
//     isValid = false;
//   }

//   return isValid;
// }

document.getElementById("signupbtn").addEventListener("click", signUp)

function signUp() {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const bio = document.getElementById("bio").value

  if (!validateSignup(email, username, password)) return;

  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      await updateProfile(userCredential.user, {
        displayName: username
      });
      console.log(userCredential.user);
      window.location.href = "./blogs.html";
    })
    .catch((error) => {
      console.log(error.message);
      showFieldError("email", "emailError", error.message);
    });
}

// document.getElementById("signupbtn").addEventListener("click", signUp);


createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const UserData = {
        email: email,
        username : username,
        bio: bio,
        photoURL: "https://share.google/K42feyWMFABlu6LHa"
      }

      await set(ref(db, "users/",userCredential.user.uid), UserData)
      await updateProfile(userCredential.user, {
        displayName: username,
      });

    })