require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!getApps().length) {
  if (!serviceAccountText) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT environment variable.");
    process.exit(1);
  }

  initializeApp({
    credential: cert(JSON.parse(serviceAccountText))
  });
}

const db = getFirestore();
const app = express();

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const DURATION_MS = 24 * 60 * 60 * 1000;

const PLANS = {
  150: 5500,
  300: 11000,
  450: 16500,
  600: 22000,
  750: 27500,
  900: 33000,
  1050: 38500,
  1200: 44000,
  1350: 49500,
  1500: 55000
};

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/);

    if (!match) {
      return res.status(401).json({ error: "Sign in required." });
    }

    const decoded = await getAuth().verifyIdToken(match[1]);
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired login token." });
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "BrasilNova Trading backend" });
});

app.get("/api/mining/session", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("users").doc(req.uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const data = snap.data();

    res.json({
      balance: Number(data.balance || 0),
      miningSession: data.miningSession || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load wallet." });
  }
});

app.post("/api/mining/start", authenticate, async (req, res) => {
  const deposit = Number(req.body.deposit);

  if (!Number.isFinite(deposit) || !PLANS[deposit]) {
    return res.status(400).json({ error: "Choose a valid mining plan." });
  }

  const target = PLANS[deposit];
  const profit = target - deposit;

  const userRef = db.collection("users").doc(req.uid);
  const escrowRef = db.collection("platformFunds").doc("miningEscrow");
  const reserveRef = db.collection("platformFunds").doc("miningRewardReserve");

  try {
    const session = await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef);
      const escrowSnap = await tx.get(escrowRef);
      const reserveSnap = await tx.get(reserveRef);

      if (!userSnap.exists) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const user = userSnap.data();
      const balance = Number(user.balance || 0);

      if (balance < deposit) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      if (user.miningSession?.status === "active") {
        throw new Error("SESSION_ALREADY_ACTIVE");
      }

      const escrow = escrowSnap.exists ? escrowSnap.data() : {};
      const reserve = reserveSnap.exists ? reserveSnap.data() : {};
      const available = Number(reserve.availableBalance || 0);

      if (available < profit) {
        throw new Error("REWARD_RESERVE_INSUFFICIENT");
      }

      const now = Date.now();
      const next = {
        status: "active",
        depositAmount: deposit,
        targetAmount: target,
        profitAmount: profit,
        startedAt: now,
        durationMs: DURATION_MS,
        credited: false,
        reference: "MIN-" + req.uid.slice(0, 6) + "-" + now
      };

      tx.set(userRef, {
        balance: balance - deposit,
        miningSession: next
      }, { merge: true });

      tx.set(escrowRef, {
        balance: Number(escrow.balance || 0) + deposit
      }, { merge: true });

      tx.set(reserveRef, {
        availableBalance: available - profit,
        reservedBalance: Number(reserve.reservedBalance || 0) + profit,
        paidBalance: Number(reserve.paidBalance || 0)
      }, { merge: true });

      return next;
    });

    res.json({
      success: true,
      message: "Mining session started.",
      miningSession: session
    });
  } catch (err) {
    const messages = {
      PROFILE_NOT_FOUND: [404, "User profile not found."],
      INSUFFICIENT_BALANCE: [400, "Insufficient wallet balance."],
      SESSION_ALREADY_ACTIVE: [409, "Finish your current session first."],
      REWARD_RESERVE_INSUFFICIENT: [
        409,
        "The reward reserve is not sufficiently funded for this plan."
      ]
    };

    const known = messages[err.message];

    if (known) {
      return res.status(known[0]).json({ error: known[1] });
    }

    console.error(err);
    res.status(500).json({ error: "Could not start mining session." });
  }
});

app.post("/api/mining/complete", authenticate, async (req, res) => {
  const userRef = db.collection("users").doc(req.uid);
  const escrowRef = db.collection("platformFunds").doc("miningEscrow");
  const reserveRef = db.collection("platformFunds").doc("miningRewardReserve");

  try {
    const result = await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef);
      const escrowSnap = await tx.get(escrowRef);
      const reserveSnap = await tx.get(reserveRef);

      if (!userSnap.exists) throw new Error("PROFILE_NOT_FOUND");

      const user = userSnap.data();
      const session = user.miningSession;

      if (!session || session.status !== "active") {
        throw new Error("NO_ACTIVE_SESSION");
      }

      const elapsed = Date.now() - Number(session.startedAt || 0);

      if (elapsed < DURATION_MS) {
        throw new Error("SESSION_NOT_FINISHED");
      }

      const deposit = Number(session.depositAmount || 0);
      const profit = Number(session.profitAmount || 0);
      const escrow = escrowSnap.exists ? escrowSnap.data() : {};
      const reserve = reserveSnap.exists ? reserveSnap.data() : {};

      if (Number(escrow.balance || 0) < deposit) {
        throw new Error("ESCROW_INSUFFICIENT");
      }

      if (Number(reserve.reservedBalance || 0) < profit) {
        throw new Error("RESERVE_INSUFFICIENT");
      }

      const completed = {
        ...session,
        status: "completed",
        completedAt: Date.now(),
        credited: true
      };

      tx.set(userRef, {
        balance: Number(user.balance || 0) + deposit + profit,
        miningSession: completed
      }, { merge: true });

      tx.set(escrowRef, {
        balance: Number(escrow.balance || 0) - deposit
      }, { merge: true });

      tx.set(reserveRef, {
        reservedBalance: Number(reserve.reservedBalance || 0) - profit,
        paidBalance: Number(reserve.paidBalance || 0) + profit
      }, { merge: true });

      return {
        balance: Number(user.balance || 0) + deposit + profit,
        miningSession: completed
      };
    });

    res.json({
      success: true,
      message: "Session completed and wallet credited.",
      ...result
    });
  } catch (err) {
    const messages = {
      PROFILE_NOT_FOUND: [404, "User profile not found."],
      NO_ACTIVE_SESSION: [409, "No active session to complete."],
      SESSION_NOT_FINISHED: [409, "The 24-hour session is not finished yet."],
      ESCROW_INSUFFICIENT: [500, "Escrow accounting needs administrator review."],
      RESERVE_INSUFFICIENT: [500, "Reward reserve accounting needs administrator review."]
    };

    const known = messages[err.message];

    if (known) {
      return res.status(known[0]).json({ error: known[1] });
    }

    console.error(err);
    res.status(500).json({ error: "Could not complete mining session." });
  }
});

const port = Number(process.env.PORT || 3001);

app.listen(port, "0.0.0.0", () => {
  console.log(`BrasilNova backend listening on port ${port}`);
});
