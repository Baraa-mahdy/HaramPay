import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  push,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase config placeholder
const firebaseConfig = {
  apiKey: "AIzaSyC45eKCJzh8ss51lFKwYglnH9Ovcr4cpq0",
  authDomain: "harampay-293ba.firebaseapp.com",
  projectId: "harampay-293ba",
  storageBucket: "harampay-293ba.firebasestorage.app",
  messagingSenderId: "1086393459596",
  appId: "1:1086393459596:web:f223887a1ca850283ceca9",
  measurementId: "G-88S5CJJJRB",
};

const USERS = ["Mohamed", "Omar", "Bilal", "Baraa", "Zeyad", "Zuhair"];

let app;
let auth;
let db;
let firebaseReady = false;

let loginPanel;
let loginSelect;
let loginBtn;
let logoutBtn;
let userChip;
let tabs;
let tabButtons;
let tabPanels;
let contentArea;
let userCards;
let totalReports;
let totalUsers;
let offenderSelect;
let reporterName;
let reportForm;
let wordInput;
let historyList;
let toast;
let toastText;
let floatingLayer;

let currentUserName = "";

const isFirebaseConfigReady = () => {
  const values = Object.values(firebaseConfig);
  return values.every((value) =>
    value && !String(value).startsWith("YOUR_")
  );
};

const setToast = (message) => {
  toastText.textContent = message;
  toast.classList.add("toast--show");
  window.setTimeout(() => toast.classList.remove("toast--show"), 2400);
};

const setLoggedInUI = (name) => {
  currentUserName = name || "";
  const isLoggedIn = Boolean(name);
  loginPanel.style.display = isLoggedIn ? "none" : "flex";
  tabs.style.display = isLoggedIn ? "flex" : "none";
  contentArea.style.display = isLoggedIn ? "grid" : "none";
  userChip.textContent = isLoggedIn ? name : "Guest";
  reporterName.value = isLoggedIn ? name : "";
  logoutBtn.disabled = !isLoggedIn;
  logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  reportForm.querySelectorAll("input, select, button").forEach((el) => {
    el.disabled = !isLoggedIn;
  });
};

const ensureUsersExist = async () => {
  await Promise.all(
    USERS.map(async (name) => {
      const userRef = ref(db, `users/${name}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        await set(userRef, { name, balance: 0, updatedAt: serverTimestamp() });
      }
    })
  );
};

const listenToUsers = () => {
  const usersRef = ref(db, "users");
  return onValue(usersRef, (snapshot) => {
    const data = snapshot.val() || {};
    const users = USERS.map((name) => data[name] || { name, balance: 0 });

    userCards.innerHTML = "";
    users.forEach((user) => {
      const card = document.createElement("div");
      const balance = Number(user.balance || 0);
      card.className = `user-card ${
        balance >= 0 ? "user-card--good" : "user-card--bad"
      }`;
      card.innerHTML = `
        <div class="user-card__name">${user.name}</div>
        <div class="user-card__balance">${balance} Riyal</div>
      `;
      userCards.appendChild(card);
    });

    totalUsers.textContent = users.length;
  });
};

const listenToTransactions = () => {
  const transactionsRef = ref(db, "transactions");
  return onValue(transactionsRef, (snapshot) => {
    historyList.innerHTML = "";
    const data = snapshot.val() || {};
    const items = Object.values(data).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    totalReports.textContent = items.length;

    items.forEach((entry) => {
      const time = entry.timestamp ? new Date(entry.timestamp) : new Date();
      const formattedTime = time.toLocaleString();
      const impactLines = Object.entries(entry.balanceChanges || {})
        .map(([name, delta]) => `${name}: ${delta > 0 ? "+" : ""}${delta}`)
        .join(" • ");

      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div class="history-item__meta">
          <span>Reporter: ${entry.reporter}</span>
          <span>${formattedTime}</span>
        </div>
        <strong>${entry.offender}</strong> said "${entry.word}"
        <div class="history-item__impact">${impactLines}</div>
      `;
      historyList.appendChild(item);
    });
  });
};

const animateReportImpact = (offender) => {
  floatingLayer.innerHTML = "";
  const badges = USERS.map((name) => {
    const badge = document.createElement("div");
    const delta = name === offender ? -1 : 1;
    badge.className = "float-badge";
    badge.textContent = `${delta > 0 ? "+" : ""}${delta} ${name}`;
    badge.style.left = `${10 + Math.random() * 70}%`;
    badge.style.top = `${20 + Math.random() * 60}px`;
    floatingLayer.appendChild(badge);
    return badge;
  });

  window.setTimeout(() => {
    badges.forEach((badge) => badge.remove());
  }, 2000);
};

const handleLogin = async () => {
  if (!firebaseReady) {
    setToast("Firebase is not configured yet.");
    console.warn("Login blocked: Firebase config is missing.");
    return;
  }

  const selected = loginSelect.value;
  if (!selected) {
    setToast("Pick your name to continue.");
    return;
  }

  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;
  await set(ref(db, `sessions/${uid}`), {
    name: selected,
    updatedAt: serverTimestamp(),
  });
  localStorage.setItem("haramPayName", selected);
  setLoggedInUI(selected);
  console.log("Login success:", selected);
  setToast(`Welcome back, ${selected}.`);
};

const handleLogout = async () => {
  if (!firebaseReady) {
    setToast("Firebase is not configured yet.");
    console.warn("Logout blocked: Firebase config is missing.");
    return;
  }

  await signOut(auth);
  localStorage.removeItem("haramPayName");
  setLoggedInUI("");
  console.log("Logout success");
};

const handleReport = async (event) => {
  event.preventDefault();
  if (!firebaseReady) {
    setToast("Firebase is not configured yet.");
    console.warn("Report blocked: Firebase config is missing.");
    return;
  }
  if (!currentUserName) {
    setToast("Please sign in first.");
    return;
  }

  const offender = offenderSelect.value;
  const word = wordInput.value.trim();

  if (!offender || !word) {
    setToast("Select an offender and add the word.");
    return;
  }

  if (offender === currentUserName) {
    setToast("You cannot report yourself.");
    return;
  }

  const balanceChanges = USERS.reduce((acc, name) => {
    acc[name] = name === offender ? -1 : 1;
    return acc;
  }, {});

  try {
    const usersRef = ref(db, "users");
    await runTransaction(usersRef, (current) => {
      const next = current || {};
      USERS.forEach((name) => {
        const existing = next[name] || { name, balance: 0 };
        const currentBalance = Number(existing.balance || 0);
        next[name] = {
          ...existing,
          name,
          balance: currentBalance + balanceChanges[name],
          updatedAt: serverTimestamp(),
        };
      });
      return next;
    });

    const txRef = push(ref(db, "transactions"));
    await set(txRef, {
      reporter: currentUserName,
      offender,
      word,
      timestamp: serverTimestamp(),
      balanceChanges,
    });

    wordInput.value = "";
    offenderSelect.value = "";
    setToast("Report saved. Balances updated.");
    animateReportImpact(offender);
    console.log("Report submitted:", { reporter: currentUserName, offender, word });
  } catch (error) {
    setToast("Something went wrong. Try again.");
    console.error(error);
  }
};

const setupTabs = () => {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((tab) => tab.classList.remove("tab--active"));
      tabPanels.forEach((panel) => panel.classList.remove("tab-panel--active"));
      button.classList.add("tab--active");
      const target = document.getElementById(button.dataset.tab);
      if (target) {
        target.classList.add("tab-panel--active");
      }
    });
  });
};

const restoreSession = async () => {
  const localName = localStorage.getItem("haramPayName") || "";
  if (localName) {
    setLoggedInUI(localName);
  } else {
    setLoggedInUI("");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  loginPanel = document.getElementById("loginPanel");
  loginSelect = document.getElementById("loginSelect");
  loginBtn = document.getElementById("loginBtn");
  logoutBtn = document.getElementById("logoutBtn");
  userChip = document.getElementById("userChip");
  tabs = document.getElementById("tabs");
  tabButtons = tabs.querySelectorAll(".tab");
  tabPanels = document.querySelectorAll(".tab-panel");
  contentArea = document.querySelector(".content");
  userCards = document.getElementById("userCards");
  totalReports = document.getElementById("totalReports");
  totalUsers = document.getElementById("totalUsers");
  offenderSelect = document.getElementById("offenderSelect");
  reporterName = document.getElementById("reporterName");
  reportForm = document.getElementById("reportForm");
  wordInput = document.getElementById("wordInput");
  historyList = document.getElementById("historyList");
  toast = document.getElementById("toast");
  toastText = document.getElementById("toastText");
  floatingLayer = document.getElementById("floatingLayer");

  setLoggedInUI("");
  setupTabs();

  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  reportForm.addEventListener("submit", handleReport);

  if (!isFirebaseConfigReady()) {
    console.warn("Firebase config is missing. Update firebaseConfig in app.js.");
    setToast("Add Firebase config to enable login.");
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    firebaseReady = true;
  } catch (error) {
    console.error("Firebase init failed:", error);
    setToast("Firebase init failed. Check config.");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const sessionSnap = await get(ref(db, `sessions/${user.uid}`));
      const sessionData = sessionSnap.exists() ? sessionSnap.val() : null;
      const name = sessionData ? sessionData.name : "";
      if (name) {
        localStorage.setItem("haramPayName", name);
        setLoggedInUI(name);
        console.log("Auth state: logged in", name);
      } else {
        await restoreSession();
      }
    } else {
      await restoreSession();
      console.log("Auth state: logged out");
    }
  });

  await ensureUsersExist();
  listenToUsers();
  listenToTransactions();
});
