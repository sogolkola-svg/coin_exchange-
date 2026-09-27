const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new Database("database.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const addAccount = db.prepare(`
  INSERT OR IGNORE INTO accounts (username, balance)
  VALUES (?, ?)
`);

addAccount.run("@heart_love33", 5917675.22);
addAccount.run("@usern1d4k0lifq", 2000000);

app.get("/api/account", (req, res) => {
  const username = String(req.query.username || "").trim();

  if (!username) {
    return res.status(400).json({ error: "Введите username" });
  }

  const account = db
    .prepare("SELECT username, balance FROM accounts WHERE username = ?")
    .get(username);

  if (!account) {
    return res.status(404).json({ error: "Аккаунт не найден" });
  }

  res.json(account);
});

app.get("/api/transactions", (req, res) => {
  const username = String(req.query.username || "").trim();

  const rows = db
    .prepare(`
      SELECT id, username, amount, balance_after, created_at
      FROM transactions
      WHERE username = ?
      ORDER BY id DESC
    `)
    .all(username);

  res.json(rows);
});

const exchange = db.transaction((username, amount) => {
  const account = db
    .prepare("SELECT username, balance FROM accounts WHERE username = ?")
    .get(username);

  if (!account) {
    throw new Error("Аккаунт не найден");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Некорректная сумма");
  }

  if (account.balance < amount) {
    throw new Error("Недостаточно средств");
  }

  const newBalance = account.balance - amount;

  db.prepare(`
    UPDATE accounts
    SET balance = ?
    WHERE username = ?
  `).run(newBalance, username);

  const result = db.prepare(`
    INSERT INTO transactions
    (username, amount, balance_after, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    username,
    amount,
    newBalance,
    new Date().toISOString()
  );

  return {
    transactionId: result.lastInsertRowid,
    username,
    amount,
    balance: newBalance
  };
});

app.post("/api/exchange", (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const amount = Number(req.body.amount);

    if (!username) {
      return res.status(400).json({ error: "Введите username" });
    }

    const result = exchange(username, amount);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
