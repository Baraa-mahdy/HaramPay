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
  update,
  onValue,
  push,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD-sEyKRNYBDqiCi3Z0UNABni4_M47pKIc",
  authDomain: "harampayzezoediton.firebaseapp.com",
  projectId: "harampayzezoediton",
  storageBucket: "harampayzezoediton.firebasestorage.app",
  messagingSenderId: "546279195040",
  appId: "1:546279195040:web:3c26726eb14b4ad2afe4c5",
  measurementId: "G-963ZPP9Y9R"
};

const USERS = ["Aissar", "Abdo", "Omar", "Zuhair"];
const ADMIN_NAME = "Zuhair";
const ADMIN_PASSWORD = "5118";

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
let debtsOwedList;
let myReportsList;
let toast;
let toastText;
let floatingLayer;
let adminPassword;
let heardList;
let adminTab;
let pendingReports;
let aboutBalance;
let totalOwed;
let totalReceive;
let oweList;
let owedList;

let currentUserName = "";
let currentRole = "user";
let usersCache = {};
let transactionsCache = {};
let reportsCache = {};

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

const toggleAdminPassword = () => {
  const isAdminSelected = loginSelect.value === ADMIN_NAME;
  adminPassword.style.display = isAdminSelected ? "block" : "none";
  adminPassword.value = "";
};

const renderHeardList = () => {
  if (!heardList) {
    console.error("heardList element not found");
    return;
  }
  heardList.innerHTML = "";
  USERS.forEach((name) => {
    const wrapper = document.createElement("label");
    wrapper.className = "checkbox-item";
    wrapper.innerHTML = `
      <input type="checkbox" value="${name}" />
      <span>${name}</span>
    `;
    heardList.appendChild(wrapper);
  });
};

const getHeardBySelection = () => {
  if (!heardList) return [];
  return Array.from(heardList.querySelectorAll("input:checked")).map(
    (input) => input.value
  );
};

const renderDebtsOwed = () => {
  if (!debtsOwedList || !currentUserName) return;
  debtsOwedList.innerHTML = "";

  const myDebts = Object.values(transactionsCache || {})
    .filter(tx => tx && tx.sender === currentUserName)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (!myDebts.length) {
    debtsOwedList.innerHTML = "<div class=\"list-item list-item__empty\">No debts to pay. You're all clear!</div>";
    return;
  }

  const debtMap = {};
  myDebts.forEach(tx => {
    const receiver = tx.receiver;
    if (!debtMap[receiver]) {
      debtMap[receiver] = { amount: 0, entries: [] };
    }
    debtMap[receiver].amount += Number(tx.amount || 0);
    debtMap[receiver].entries.push(tx.id);
  });

  Object.entries(debtMap).forEach(([receiver, data]) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item__meta">
        <span>Pay to: <strong>${receiver}</strong></span>
      </div>
      <div class="history-item__impact" style="font-size: 1.2em; margin: 0.5rem 0;">
        <strong>${data.amount} Riyal</strong>
      </div>
      <div class="action-row">
        <button class="button button--accept" data-receiver="${receiver}" data-amount="${data.amount}" data-action="mark-paid">
          Mark as Paid
        </button>
      </div>
    `;
    debtsOwedList.appendChild(item);
  });
};

const renderMyReports = () => {
  if (!myReportsList) return;
  myReportsList.innerHTML = "";

  if (!currentUserName) {
    myReportsList.innerHTML = "<div class=\"list-item list-item__empty\">Sign in to view your reports.</div>";
    return;
  }

  const items = Object.values(reportsCache || {})
    .filter((entry) => entry && entry.reporter === currentUserName)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (!items.length) {
    myReportsList.innerHTML = "<div class=\"list-item list-item__empty\">No reports submitted yet.</div>";
    return;
  }

  items.forEach((entry) => {
    const time = entry.timestamp ? new Date(entry.timestamp) : new Date();
    const formattedTime = time.toLocaleString();
    const status = entry.status || "pending";
    const heardText = entry.heardBy?.length ? entry.heardBy.join(", ") : "All others";

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-item__meta">
        <span>${formattedTime}</span>
        <span class="status-pill status-pill--${status}">${status}</span>
      </div>
      <strong>${entry.offender}</strong> said "${entry.word}"
      <div class="history-item__impact">Heard by: ${heardText}</div>
    `;
    myReportsList.appendChild(item);
  });
};

const updateAboutMe = () => {
  if (!currentUserName) {
    aboutBalance.textContent = "0";
    totalOwed.textContent = "0";
    totalReceive.textContent = "0";
    oweList.innerHTML = "<div class=\"list-item list-item__empty\">Sign in to view details.</div>";
    owedList.innerHTML = "<div class=\"list-item list-item__empty\">Sign in to view details.</div>";
    return;
  }

  const userData = usersCache[currentUserName] || { balance: 0 };
  aboutBalance.textContent = `${Number(userData.balance || 0)} Riyal`;

  const oweMap = {};
  const owedMap = {};

  Object.values(transactionsCache).forEach((tx) => {
    if (!tx || !tx.sender || !tx.receiver || !tx.amount) return;
    const amount = Number(tx.amount || 0);
    if (tx.sender === currentUserName) {
      oweMap[tx.receiver] = (oweMap[tx.receiver] || 0) + amount;
    }
    if (tx.receiver === currentUserName) {
      owedMap[tx.sender] = (owedMap[tx.sender] || 0) + amount;
    }
  });

  const oweEntries = Object.entries(oweMap).sort((a, b) => b[1] - a[1]);
  const owedEntries = Object.entries(owedMap).sort((a, b) => b[1] - a[1]);

  oweList.innerHTML = "";
  owedList.innerHTML = "";

  if (!oweEntries.length) {
    oweList.innerHTML = "<div class=\"list-item list-item__empty\">No debts owed.</div>";
  } else {
    oweEntries.forEach(([name, amount]) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${name}</span><strong>${amount} Riyal</strong>`;
      oweList.appendChild(item);
    });
  }

  if (!owedEntries.length) {
    owedList.innerHTML = "<div class=\"list-item list-item__empty\">No one owes you.</div>";
  } else {
    owedEntries.forEach(([name, amount]) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${name}</span><strong>${amount} Riyal</strong>`;
      owedList.appendChild(item);
    });
  }

  const totalOwedAmount = oweEntries.reduce((sum, [, amount]) => sum + amount, 0);
  const totalReceiveAmount = owedEntries.reduce(
    (sum, [, amount]) => sum + amount,
    0
  );
  totalOwed.textContent = `${totalOwedAmount} Riyal`;
  totalReceive.textContent = `${totalReceiveAmount} Riyal`;
};

const setLoggedInUI = (name, role = "user") => {
  currentUserName = name || "";
  currentRole = role || "user";
  const isLoggedIn = Boolean(name);
  const isAdmin = isLoggedIn && currentRole === "admin";
  loginPanel.style.display = isLoggedIn ? "none" : "flex";
  tabs.style.display = isLoggedIn ? "flex" : "none";
  contentArea.style.display = isLoggedIn ? "grid" : "none";
  userChip.textContent = isLoggedIn ? name : "Guest";
  if (reporterName) reporterName.value = isLoggedIn ? name : "";
  logoutBtn.disabled = !isLoggedIn;
  logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  if (adminTab) adminTab.style.display = isAdmin ? "inline-flex" : "none";
  if (reportForm) {
    reportForm.querySelectorAll("input, select, button").forEach((el) => {
      el.disabled = !isLoggedIn;
    });
  }
  // Form state updates handled by listeners
  if (!isAdmin && adminTab.classList.contains("tab--active")) {
    const fallback = document.querySelector(".tab[data-tab='dashboard']");
    fallback?.click();
  }
  updateAboutMe();
  renderMyReports();
};

const ensureUsersExist = async () => {
  await Promise.all(
    USERS.map(async (name) => {
      const userRef = ref(db, `users/${name}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        await set(userRef, {
          name,
          balance: 0,
          role: name === ADMIN_NAME ? "admin" : "user",
          updatedAt: serverTimestamp(),
        });
      }
    })
  );
};

const listenToUsers = () => {
  const usersRef = ref(db, "users");
  return onValue(usersRef, (snapshot) => {
    const data = snapshot.val() || {};
    usersCache = data;
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
    updateAboutMe();
  });
};

// Listen to reports for Admin Panel only
const listenToReports = () => {
  const reportsRef = ref(db, "reports");
  return onValue(reportsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const items = Object.entries(data).map(([id, entry]) => ({ ...entry, id }));
    console.log("Reports listener triggered. Total reports:", items.length);

    reportsCache = items.reduce((acc, entry) => {
      acc[entry.id] = entry;
      return acc;
    }, {});

    // Filter by status
    const pending = items.filter((r) => r.status === "pending");
    const accepted = items.filter((r) => r.status === "accepted");

    totalReports.textContent = accepted.length;

    // Render ONLY pending reports in Admin Panel
    if (!pendingReports) return;
    pendingReports.innerHTML = "";
    if (!pending.length) {
      pendingReports.innerHTML = "<div class=\"list-item list-item__empty\">No pending reports.</div>";
      console.log("No pending reports");
    } else {
      console.log("Pending reports:", pending.length);
      pending.forEach((entry) => {
        const time = entry.timestamp ? new Date(entry.timestamp) : new Date();
        const formattedTime = time.toLocaleString();
        const heardText = entry.heardBy?.length
          ? entry.heardBy.join(", ")
          : "All others";

        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
          <div class="history-item__meta">
            <span>Reporter: ${entry.reporter}</span>
            <span>${formattedTime}</span>
            <span class="status-pill status-pill--pending">pending</span>
          </div>
          <strong>${entry.offender}</strong> said "${entry.word}"
          <div class="history-item__impact">Heard by: ${heardText}</div>
          <div class="action-row">
            <button class="button button--accept" data-id="${entry.id}" data-action="accept">Accept</button>
            <button class="button button--reject" data-id="${entry.id}" data-action="reject">Reject</button>
          </div>
        `;
        pendingReports.appendChild(item);
      });
    }

    renderMyReports();
  });
};

// Listen to approved transactions and manual transactions for Transactions Tab
const listenToTransactions = () => {
  // Not actively used - using listenToManualTransactions instead
  return () => {};
};

// Listen to manual transactions for About Me calculations
const listenToManualTransactions = () => {
  const txRef = ref(db, "manualTransactions");
  return onValue(txRef, (snapshot) => {
    const data = snapshot.val() || {};
    transactionsCache = data;
    console.log("📡 Manual transactions cache updated:", Object.keys(data).length);
    updateAboutMe();
    renderDebtsOwed();
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
  console.log("Login button clicked");
  
  if (!firebaseReady) {
    setToast("Firebase is not configured yet.");
    console.warn("Login blocked: Firebase config is missing.");
    return;
  }

  const selected = loginSelect.value;
  console.log("Selected user:", selected);
  
  if (!selected) {
    setToast("Pick your name to continue.");
    return;
  }

  // Admin password check
  if (selected === ADMIN_NAME) {
    const enteredPassword = adminPassword.value.trim();
    console.log("Admin login attempt");
    if (enteredPassword !== ADMIN_PASSWORD) {
      setToast("Incorrect admin password.");
      console.warn("Incorrect admin password");
      return;
    }
  }

  try {
    console.log("Starting authentication...");
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInAnonymously(auth);
    const uid = credential.user.uid;
    console.log("Auth successful, UID:", uid);

    const userRole = selected === ADMIN_NAME ? "admin" : "user";

    await set(ref(db, `sessions/${uid}`), {
      name: selected,
      role: userRole,
      updatedAt: serverTimestamp(),
    });
    localStorage.setItem("haramPayName", selected);
    localStorage.setItem("haramPayRole", userRole);
    setLoggedInUI(selected, userRole);
    console.log("Login success:", selected, userRole);
    setToast(`Welcome back, ${selected}.`);
  } catch (error) {
    console.error("Login error:", error);
    setToast("Login failed. Check console for details.");
  }
};

const handleLogout = async () => {
  if (!firebaseReady) {
    setToast("Firebase is not configured yet.");
    console.warn("Logout blocked: Firebase config is missing.");
    return;
  }

  await signOut(auth);
  localStorage.removeItem("haramPayName");
  localStorage.removeItem("haramPayRole");
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
  const heardBy = getHeardBySelection();

  if (!offender || !word) {
    setToast("Select an offender and add the word.");
    return;
  }

  if (offender === currentUserName) {
    setToast("You cannot report yourself.");
    return;
  }

  if (!heardBy.length) {
    setToast("Select at least one person who heard it.");
    return;
  }

  try {
    // Create pending report
    const reportRef = push(ref(db, "reports"));
    await set(reportRef, {
      reporter: currentUserName,
      offender,
      word,
      heardBy,
      timestamp: serverTimestamp(),
      status: "pending",
    });

    wordInput.value = "";
    offenderSelect.value = "";
    if (heardList) {
      heardList.querySelectorAll("input").forEach((input) => (input.checked = false));
    }
    setToast("Report submitted. Waiting for admin approval.");
    console.log("✅ Report submitted successfully:", { reporter: currentUserName, offender, word, heardBy, status: "pending" });
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

// Handle admin approve/reject
const handleAdminAction = async (event) => {
  const target = event.target;
  if (!target.dataset.action) return;
  const reportId = target.dataset.id;
  const action = target.dataset.action;

  const reportRef = ref(db, `reports/${reportId}`);
  const snapshot = await get(reportRef);
  if (!snapshot.exists()) {
    setToast("Report not found.");
    return;
  }

  const report = snapshot.val();
  
  if (action === "reject") {
    console.log("Rejecting report:", reportId);
    await update(reportRef, { status: "rejected" });
    setToast("Report rejected.");
    console.log("❌ Report rejected:", reportId);
    return;
  }

  if (action === "accept") {
    const offender = report.offender;
    const heardBy = report.heardBy || [];
    console.log("Approving report:", reportId, { offender, heardBy });

    try {
      // 1. Create debt entries in manualTransactions (balance updates only when paid)
      for (const receiver of heardBy) {
        const mtxRef = push(ref(db, "manualTransactions"));
        await set(mtxRef, {
          sender: offender,
          receiver,
          amount: 1,
          note: `Report: "${report.word}"`,
          timestamp: serverTimestamp(),
        });
      }
      console.log("✅ Debt entries created for report:", reportId, { offender, heardBy });

      // 2. Create transaction entry for history
      const txRef = push(ref(db, "transactions"));
      await set(txRef, {
        type: "report",
        reporter: report.reporter,
        offender: report.offender,
        word: report.word,
        heardBy: report.heardBy || [],
        timestamp: serverTimestamp(),
      });
      console.log("Transaction created for report:", reportId);

      // 3. Update report status
      await update(reportRef, { status: "accepted" });
      console.log("Report status updated to accepted:", reportId);

      setToast("Report accepted. Offender must pay to update balances.");
      console.log("Report approval complete:", reportId);
    } catch (error) {
      console.error("Error approving report:", error);
      setToast("Error approving report. Check console.");
    }
  }
};

// Handle Mark as Paid
const handleMarkAsPaid = async (event) => {
  const target = event.target;
  if (target.dataset.action !== "mark-paid") return;

  const receiver = target.dataset.receiver;
  const amount = Number(target.dataset.amount || 0);

  if (!firebaseReady || !currentUserName) {
    setToast("Please sign in first.");
    return;
  }

  try {
    // Find all debts to this receiver and collect info
    const debtIds = Object.entries(transactionsCache || {})
      .filter(([_, tx]) => tx && tx.sender === currentUserName && tx.receiver === receiver)
      .map(([id]) => id);

    if (!debtIds.length) {
      setToast("No debts found to pay.");
      return;
    }

    // 1. Update balances atomically
    const usersRef = ref(db, "users");
    await runTransaction(usersRef, (current) => {
      const next = current || {};
      const senderData = next[currentUserName] || { name: currentUserName, balance: 0 };
      const receiverData = next[receiver] || { name: receiver, balance: 0 };
      
      next[currentUserName] = {
        ...senderData,
        balance: Number(senderData.balance || 0) - amount,
        updatedAt: serverTimestamp(),
      };
      next[receiver] = {
        ...receiverData,
        balance: Number(receiverData.balance || 0) + amount,
        updatedAt: serverTimestamp(),
      };
      return next;
    });
    console.log("✅ Balances updated on payment:", { sender: currentUserName, receiver, amount });

    // 2. Delete all debt entries for this receiver
    for (const debtId of debtIds) {
      await set(ref(db, `manualTransactions/${debtId}`), null);
    }
    console.log("✅ Debts cleared for:", receiver);

    setToast(`Paid ${amount} Riyal to ${receiver}. Balances updated!`);
    console.log("✅ Payment complete:", { sender: currentUserName, receiver, amount });
  } catch (error) {
    setToast("Failed to mark as paid. Try again.");
    console.error(error);
  }
};

const restoreSession = async () => {
  const localName = localStorage.getItem("haramPayName") || "";
  const localRole = localStorage.getItem("haramPayRole") || "user";
  if (localName) {
    setLoggedInUI(localName, localRole);
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
  debtsOwedList = document.getElementById("debtsOwedList");
  myReportsList = document.getElementById("myReportsList");
  toast = document.getElementById("toast");
  toastText = document.getElementById("toastText");
  floatingLayer = document.getElementById("floatingLayer");
  adminPassword = document.getElementById("adminPassword");
  heardList = document.getElementById("heardList");
  adminTab = document.getElementById("adminTab");
  pendingReports = document.getElementById("pendingReports");
  aboutBalance = document.getElementById("aboutBalance");
  totalOwed = document.getElementById("totalOwed");
  totalReceive = document.getElementById("totalReceive");
  oweList = document.getElementById("oweList");
  owedList = document.getElementById("owedList");

  console.log("DOM loaded, initializing app...");
  console.log("DOM elements loaded:", {
    loginBtn: !!loginBtn,
    reportForm: !!reportForm,
    debtsOwedList: !!debtsOwedList,
    myReportsList: !!myReportsList,
    adminPassword: !!adminPassword,
    adminTab: !!adminTab,
    pendingReports: !!pendingReports,
    heardList: !!heardList
  });
  
  renderHeardList();
  
  if (adminPassword) {
    adminPassword.style.display = "none";
  } else {
    console.error("adminPassword element not found!");
  }

  setupTabs();
  setLoggedInUI("");

  if (loginSelect && loginBtn) {
    loginSelect.addEventListener("change", toggleAdminPassword);
    loginBtn.addEventListener("click", handleLogin);
    console.log("Login listeners attached");
  } else {
    console.error("Login elements not found!", { loginSelect, loginBtn });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
  
  if (reportForm) {
    reportForm.addEventListener("submit", handleReport);
  } else {
    console.error("reportForm not found!");
  }
  
  if (debtsOwedList) {
    debtsOwedList.addEventListener("click", handleMarkAsPaid);
  } else {
    console.error("debtsOwedList not found!");
  }
  
  if (pendingReports) {
    pendingReports.addEventListener("click", handleAdminAction);
  } else {
    console.error("pendingReports not found!");
  }

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
      const role = sessionData ? sessionData.role : "user";
      if (name) {
        localStorage.setItem("haramPayName", name);
        localStorage.setItem("haramPayRole", role);
        setLoggedInUI(name, role);
        console.log("Auth state: logged in", name, role);
      } else {
        await restoreSession();
      }
    } else {
      await restoreSession();
      console.log("Auth state: logged out");
    }
  });

  await ensureUsersExist();
  console.log("Setting up Firebase listeners...");
  listenToUsers();
  listenToReports();
  listenToTransactions();
  listenToManualTransactions();
  console.log("All Firebase listeners active");
});
