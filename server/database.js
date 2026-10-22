import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { aparelhos, salas } from "../src/dados/mockData.js";

const databasePath = process.env.DATABASE_PATH || "./data/sesi.db";
fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
const database = new Database(databasePath);

database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");
database.pragma("busy_timeout = 5000");

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rm TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    is_dev INTEGER NOT NULL DEFAULT 0,
    requested_admin_role TEXT,
    email_verified INTEGER NOT NULL DEFAULT 1,
    password_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    kind TEXT NOT NULL,
    block TEXT NOT NULL DEFAULT 'A' CHECK (block IN ('A', 'B'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    type TEXT NOT NULL,
    brand TEXT NOT NULL,
    total INTEGER NOT NULL CHECK (total >= 0),
    available INTEGER NOT NULL CHECK (available >= 0 AND available <= total),
    tone TEXT NOT NULL DEFAULT 'blue',
    icon TEXT NOT NULL DEFAULT '▣',
    location TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    device_id INTEGER NOT NULL REFERENCES devices(id),
    responsible TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    room_id TEXT NOT NULL REFERENCES rooms(id),
    department TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    return_time TEXT NOT NULL,
    due_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('Pendente', 'Em uso', 'Devolvido', 'Recusado')),
    returned_at TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS loans_owner_status ON loans(owner_id, status);
  CREATE INDEX IF NOT EXISTS loans_device_status ON loans(device_id, status);
  CREATE INDEX IF NOT EXISTS activity_log_created ON activity_log(created_at);
`);

const loanColumns = database.prepare("PRAGMA table_info(loans)").all();
if (!loanColumns.some((column) => column.name === "due_at")) {
  database.exec("ALTER TABLE loans ADD COLUMN due_at TEXT");
}

const roomColumns = database.prepare("PRAGMA table_info(rooms)").all();
if (!roomColumns.some((column) => column.name === "block")) {
  database.exec("ALTER TABLE rooms ADD COLUMN block TEXT NOT NULL DEFAULT 'A'");
}

const userColumns = database.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "is_dev")) {
  database.exec("ALTER TABLE users ADD COLUMN is_dev INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((column) => column.name === "requested_admin_role")) {
  database.exec("ALTER TABLE users ADD COLUMN requested_admin_role TEXT");
}
if (!userColumns.some((column) => column.name === "avatar")) {
  database.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
}
if (!userColumns.some((column) => column.name === "email_verified")) {
  database.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1");
}
database.prepare("UPDATE users SET email_verified = 1 WHERE email_verified <> 1").run();
database.exec("DROP TABLE IF EXISTS email_verifications");
if (!userColumns.some((column) => column.name === "password_updated_at")) {
  database.exec("ALTER TABLE users ADD COLUMN password_updated_at TEXT");
}
database.prepare(`
  DELETE FROM sessions
  WHERE user_id IN (SELECT id FROM users WHERE password_updated_at IS NULL)
`).run();

const previousRoomNames = new Map([
  ["lab-01", "Lab. 01"],
  ["lab-02", "Lab. 02"],
  ["lab-03", "Lab. 03"],
  ["lab-04", "Lab. 04"],
  ["sala-08", "Sala 08"],
  ["sala-12", "Sala 12"],
  ["biblioteca", "Biblioteca"],
  ["auditorio", "Auditório"],
]);
const updateLegacyRoom = database.prepare(`
  UPDATE rooms SET name = ?, kind = ?, block = ?
  WHERE id = ? AND name = ?
`);
const insertRoom = database.prepare(
  "INSERT OR IGNORE INTO rooms (id, name, kind, block) VALUES (?, ?, ?, ?)",
);
const seedRooms = database.transaction(() => {
  for (const room of salas) {
    const previousName = previousRoomNames.get(room.id);
    if (previousName) {
      updateLegacyRoom.run(room.name, room.kind, room.block, room.id, previousName);
    }
    insertRoom.run(room.id, room.name, room.kind, room.block);
  }
});
seedRooms();
database.prepare("UPDATE rooms SET kind = 'Sala de aula' WHERE kind <> 'Sala de aula'").run();

const insertDevice = database.prepare(`
  INSERT OR IGNORE INTO devices
    (name, type, brand, total, available, tone, icon, location)
  VALUES
    (@name, @type, @brand, @total, @available, @tone, @icon, @location)
`);
for (const device of aparelhos) insertDevice.run(device);
database.prepare(`
  UPDATE devices
  SET location = CASE
    WHEN lower(location) LIKE '%lmt%' THEN 'LMT'
    WHEN lower(location) LIKE '%maker%' THEN 'Maker'
    ELSE location
  END
  WHERE location NOT IN ('LMT', 'Maker')
`).run();
const unclassifiedDevices = database.prepare(
  "SELECT COUNT(*) AS count FROM devices WHERE location NOT IN ('LMT', 'Maker')",
).get().count;
if (unclassifiedDevices > 0) {
  console.warn(
    `${unclassifiedDevices} device(s) still have an unrecognized acervo location. Update them to LMT or Maker in Administration.`,
  );
}

const adminRoles = new Set([
  "Diretoria",
  "Secretaria",
  "Orientador de Educação Digital",
]);
const emailPattern = /^[^\s@]+@senaisp\.edu\.br$/i;
const rmPattern = /^\d{7}$/;
function isValidPassword(password) {
  return typeof password === "string" &&
    password.length >= 12 &&
    Buffer.byteLength(password, "utf8") <= 72;
}
const publicRoles = new Set([
  "Professor(a)",
  "Estagiário(a)",
  "Técnico(a) de laboratório",
  "Outro",
]);

database.prepare(`
  UPDATE users
  SET role = 'Orientador de Educação Digital'
  WHERE role IN ('Orientador de Estudos Digitais', 'Orientador de Educação Digital')
`).run();

const usersCount = database.prepare("SELECT COUNT(*) AS count FROM users WHERE is_dev = 0").get().count;
if (usersCount === 0) {
  const { BOOTSTRAP_ADMIN_RM, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_ROLE } = process.env;
  const hasBootstrapConfiguration = [
    BOOTSTRAP_ADMIN_RM,
    BOOTSTRAP_ADMIN_NAME,
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
  ].every((value) => value?.trim());

  if (hasBootstrapConfiguration) {
    if (!rmPattern.test(BOOTSTRAP_ADMIN_RM.trim())) {
      throw new Error("BOOTSTRAP_ADMIN_RM must contain exactly 7 digits.");
    }
    if (!emailPattern.test(BOOTSTRAP_ADMIN_EMAIL.trim())) {
      throw new Error("BOOTSTRAP_ADMIN_EMAIL must use the @senaisp.edu.br domain.");
    }
    if (!isValidPassword(BOOTSTRAP_ADMIN_PASSWORD)) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters and no more than 72 UTF-8 bytes.");
    }
    const role = adminRoles.has(BOOTSTRAP_ADMIN_ROLE)
      ? BOOTSTRAP_ADMIN_ROLE
      : "Diretoria";
    const passwordHash = bcrypt.hashSync(BOOTSTRAP_ADMIN_PASSWORD, 12);
    database.prepare(`
      INSERT INTO users (rm, name, email, role, password_hash, password_updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      BOOTSTRAP_ADMIN_RM.trim(),
      BOOTSTRAP_ADMIN_NAME.trim(),
      BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
      role,
      passwordHash,
      new Date().toISOString(),
    );
    console.info(`Initial ${role} account created from environment configuration.`);
  } else {
    console.warn(
      "No administrator exists. Set BOOTSTRAP_ADMIN_RM, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before starting the application.",
    );
  }
}

const developerRm = process.env.DEV_ADMIN_RM?.trim();
if (developerRm) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Developer admin access must not be configured in production.");
  }
  if (!/^\d{4}$/.test(developerRm)) {
    throw new Error("DEV_ADMIN_RM must contain exactly 4 digits.");
  }

  const name = `Desenvolvedor ${developerRm}`;
  const email = `dev-${developerRm}@senaisp.edu.br`;
  const existingDeveloper = database.prepare(
    "SELECT id, is_dev FROM users WHERE rm = ? COLLATE NOCASE",
  ).get(developerRm);
  if (existingDeveloper && !existingDeveloper.is_dev) {
    throw new Error("DEV_ADMIN_RM is already assigned to a non-developer account.");
  }

  const passwordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);
  if (existingDeveloper) {
    database.prepare(`
      UPDATE users SET name = ?, email = ?, role = 'Diretoria',
        password_hash = ?, active = 1, password_updated_at = ?
      WHERE id = ? AND is_dev = 1
    `).run(name, email, passwordHash, new Date().toISOString(), existingDeveloper.id);
  } else {
    database.prepare(`
      INSERT INTO users (rm, name, email, role, password_hash, is_dev, password_updated_at)
      VALUES (?, ?, ?, 'Diretoria', ?, 1, ?)
    `).run(developerRm, name, email, passwordHash, new Date().toISOString());
  }
}

export { adminRoles, database, publicRoles };
