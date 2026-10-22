import { randomBytes, randomInt, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { rateLimit } from "express-rate-limit";
import { adminRoles, database, publicRoles } from "./database.js";

const app = express();
const port = Number(process.env.PORT || 3003);
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const cookieName = "sesi_session";
const production = process.env.NODE_ENV === "production";
const host = process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1");
const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, "..");
const emailPattern = /^[^\s@]+@senaisp\.edu\.br$/i;
const rmPattern = /^\d{7}$/;
const schoolTimeZone = "America/Sao_Paulo";
const smtpHost = process.env.SMTP_HOST?.trim();
const smtpPort = Number(process.env.SMTP_PORT);
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM?.trim();
const exposePasswordResetCode =
  !production &&
  !smtpHost &&
  (
    process.env.EXPOSE_PASSWORD_RESET_CODE === "true" ||
    host === "127.0.0.1" ||
    host === "::1"
  );
const developerAccessEnabled =
  !production &&
  /^\d{4}$/.test(process.env.DEV_ADMIN_RM || "");
if (
  (production || smtpHost) &&
  (!smtpHost || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || !smtpFrom)
) {
  throw new Error("Production requires SMTP_HOST, a valid SMTP_PORT and SMTP_FROM; configure all three together.");
}
if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
  throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
}
const mailer = smtpHost
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
  })
  : null;

function isValidPassword(password) {
  return typeof password === "string" &&
    password.length >= 12 &&
    Buffer.byteLength(password, "utf8") <= 72;
}

function isValidAccount({ nome, email, funcao, rm, password }) {
  return typeof nome === "string" &&
    Boolean(nome.trim()) &&
    nome.trim().length <= 120 &&
    typeof email === "string" &&
    Boolean(email.trim()) &&
    email.trim().length <= 254 &&
    emailPattern.test(email.trim()) &&
    typeof rm === "string" &&
    rmPattern.test(rm.trim()) &&
    isValidPassword(password) &&
    (publicRoles.has(funcao) || adminRoles.has(funcao));
}

function formatInSchoolTime(date, options) {
  return date.toLocaleString("pt-BR", { ...options, timeZone: schoolTimeZone });
}

function schoolDateTime(year, month, day, hour, minute) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: schoolTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcGuess))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  const representedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(utcGuess - (representedUtc - utcGuess));
}

async function sendPasswordResetEmail(email, code) {
  if (!mailer) return false;
  await mailer.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Recuperação de senha - Agenda LMT",
    text: `Seu código para redefinir a senha do Agenda LMT é ${code}. Ele expira em 15 minutos.`,
  });
  return true;
}

function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function positiveId(value) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+$/.test(value.trim()))
  ) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isValidDevice({ name, type, brand, total }) {
  const amount = positiveId(total);
  return typeof name === "string" &&
    Boolean(name.trim()) &&
    name.trim().length <= 120 &&
    ["Notebook", "Celular"].includes(type) &&
    typeof brand === "string" &&
    Boolean(brand.trim()) &&
    brand.trim().length <= 120 &&
    amount !== null &&
    amount <= 10_000;
}

function isValidClassroom({ name, kind, block }) {
  return typeof name === "string" &&
    Boolean(name.trim()) &&
    name.trim().length <= 80 &&
    kind === "Sala de aula" &&
    ["A", "B"].includes(block);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "300kb" }));
function createRateLimiter(windowMs, limit, message, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs,
    limit,
    ...(skipSuccessfulRequests ? { skipSuccessfulRequests: true } : {}),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: message },
  });
}

const authenticationLimiter = createRateLimiter(
  30 * 1000,
  10,
  "Muitas tentativas. Aguarde 30 segundos e tente novamente.",
  true,
);
const registrationLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
);
const developerAuthenticationLimiter = createRateLimiter(
  30 * 1000,
  10,
  "Muitas tentativas. Aguarde 30 segundos e tente novamente.",
  true,
);
const passwordChangeLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
);
const passwordResetRequestLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  "Muitos pedidos de recuperação. Aguarde alguns minutos e tente novamente.",
);
const passwordResetLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  "Muitas tentativas de recuperação. Aguarde alguns minutos e tente novamente.",
);
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");

  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.get("origin");
    const host =
      !production && request.get("x-forwarded-host")
        ? request.get("x-forwarded-host")
        : request.get("host");
    if (origin) {
      try {
        if (new URL(origin).host !== host) {
          return response.status(403).json({ error: "Origem da solicitação não autorizada." });
        }
      } catch {
        return response.status(403).json({ error: "Origem da solicitação inválida." });
      }
    }
    if (request.path.startsWith("/api/") && request.get("x-requested-with") !== "XMLHttpRequest") {
      return response.status(403).json({ error: "Cabeçalho de segurança ausente." });
    }
  }
  next();
});

const findUserById = database.prepare(`
  SELECT id, rm, name, email, role, active, is_dev, requested_admin_role, avatar
  FROM users WHERE id = ?
`);

function publicUser(user) {
  return {
    id: user.id,
    registro: user.rm,
    nome: user.name,
    email: user.email,
    foto: user.avatar || null,
    funcao: user.requested_admin_role || user.role,
    isDeveloper: Boolean(user.is_dev),
    adminApprovalPending: Boolean(user.requested_admin_role),
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createActivity(actorId, message) {
  database.prepare(`
    INSERT INTO activity_log (actor_id, message, created_at)
    VALUES (?, ?, ?)
  `).run(actorId, message, new Date().toISOString());
}

function requireAuth(request, response, next) {
  const cookies = Object.fromEntries(
    (request.get("cookie") || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([name, value]) => name && value !== undefined),
  );
  const token = cookies[cookieName];
  if (!token) return response.status(401).json({ error: "Faça login para continuar." });

  const session = database.prepare(`
    SELECT user_id AS userId
    FROM sessions
    WHERE token_hash = ? AND expires_at > ?
  `).get(hashToken(token), new Date().toISOString());
  const user = session && findUserById.get(session.userId);
  if (!user || !user.active || (production && user.is_dev)) {
    return response.status(401).json({ error: "Sua sessão expirou. Faça login novamente." });
  }
  request.user = user;
  next();
}

function requireAdmin(request, response, next) {
  if (!adminRoles.has(request.user.role)) {
    return response.status(403).json({ error: "Esta ação exige perfil administrativo." });
  }
  next();
}

function issueSession(user, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();
  database.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(hashToken(token), user.id, expiresAt);
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: sessionLifetimeMs,
  });
}

function localDateTime(isoDate, time) {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: schoolTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(isoDate))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  const [hour, minute] = time.split(":").map(Number);
  return schoolDateTime(dateParts.year, dateParts.month, dateParts.day, hour, minute);
}

function serializeLoan(row) {
  const overdue =
    row.status === "Em uso" &&
    new Date(row.due_at || localDateTime(row.created_at, row.return_time)).getTime() < Date.now();
  const status = overdue ? "Atrasado" : row.status;
  const dueDate = row.due_at ? new Date(row.due_at) : null;
  return {
    id: row.id,
    ownerRm: row.owner_rm,
    deviceId: row.device_id,
    device: row.device,
    responsible: row.responsible,
    qty: row.qty,
    room: row.room,
    roomId: row.room_id,
    department: row.department,
    date: `${formatInSchoolTime(new Date(row.created_at), { dateStyle: "short" })} às ${formatInSchoolTime(new Date(row.created_at), { hour: "2-digit", minute: "2-digit" })}`,
    returnTime: dueDate
      ? formatInSchoolTime(dueDate, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : row.return_time,
    dueAt: row.due_at,
    status,
    statusTone:
      status === "Pendente"
        ? "orange"
        : status === "Atrasado" || status === "Recusado"
          ? "red"
          : "green",
    returned: row.returned_at
      ? formatInSchoolTime(new Date(row.returned_at))
      : undefined,
  };
}

const loanSelect = `
  SELECT
    loans.id, loans.owner_id, users.rm AS owner_rm, loans.device_id,
    devices.name AS device, loans.responsible, loans.qty,
    rooms.name AS room, rooms.id AS room_id, loans.department,
    loans.created_at, loans.return_time, loans.due_at, loans.status, loans.returned_at
  FROM loans
  JOIN users ON users.id = loans.owner_id
  JOIN devices ON devices.id = loans.device_id
  JOIN rooms ON rooms.id = loans.room_id
`;

app.get("/api/setup/status", (_request, response) => {
  response.json({
    hasUsers: database.prepare("SELECT EXISTS(SELECT 1 FROM users) AS value").get().value === 1,
    hasAdmin: database.prepare("SELECT EXISTS(SELECT 1 FROM users WHERE is_dev = 0 AND active = 1 AND role IN ('Diretoria', 'Secretaria', 'Orientador de Educação Digital')) AS value").get().value === 1,
    developerAccess: developerAccessEnabled,
  });
});

app.post("/api/auth/register", registrationLimiter, async (request, response) => {
  const hasAdministrator = database.prepare(`
    SELECT EXISTS(
      SELECT 1 FROM users
      WHERE role IN ('Diretoria', 'Secretaria', 'Orientador de Educação Digital')
          AND active = 1 AND is_dev = 0
    ) AS value
  `).get().value === 1;
  if (!hasAdministrator) {
    return response.status(503).json({
      error: "O sistema ainda precisa da conta administrativa inicial. Configure o bootstrap no arquivo .env.",
    });
  }

  const { nome, email, funcao, rm, password } = request.body || {};
  if (!isValidAccount({ nome, email, funcao, rm, password })) {
    return response.status(400).json({
      error: "Informe nome, e-mail @senaisp.edu.br, RM com 7 dígitos, função válida e senha com pelo menos 12 caracteres.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const normalizedEmail = email.trim().toLowerCase();
    database.prepare(`
      INSERT INTO users (
        rm, name, email, role, password_hash, requested_admin_role, password_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      rm.trim(),
      nome.trim(),
      normalizedEmail,
      adminRoles.has(funcao) ? "Outro" : funcao,
      passwordHash,
      adminRoles.has(funcao) ? funcao : null,
      new Date().toISOString(),
    );
    response.status(201).json({
      message: "Cadastro concluído. Você já pode entrar com seu RM e senha.",
      email: normalizedEmail,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "RM ou e-mail já cadastrado." });
    }
    throw error;
  }
});

app.post("/api/auth/login", authenticationLimiter, async (request, response) => {
  const { rm, password } = request.body || {};
  if (typeof rm !== "string" || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
    return response.status(400).json({ error: "Informe RM e senha." });
  }
  const user = database.prepare(`
    SELECT id, rm, name, email, role, active, is_dev, requested_admin_role,
      avatar, password_hash, password_updated_at
    FROM users WHERE rm = ? COLLATE NOCASE AND is_dev = 0
  `).get(rm.trim());

  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    return response.status(401).json({ error: "RM ou senha incorretos." });
  }
  if (!user.password_updated_at) {
    return response.status(428).json({
      error: "Por segurança, atualize sua senha antes de continuar.",
    });
  }
  issueSession(user, response);
  response.json({ user: publicUser(user) });
});

app.post("/api/dev/auth/login", developerAuthenticationLimiter, async (request, response) => {
  if (!developerAccessEnabled || !isLoopbackAddress(request.socket.remoteAddress)) {
    return response.status(404).json({ error: "Acesso de desenvolvedor indisponível." });
  }
  const { rm } = request.body || {};
  if (typeof rm !== "string" || !/^\d{4}$/.test(rm.trim())) {
    return response.status(400).json({ error: "Informe o RM dev com exatamente 4 dígitos." });
  }
  const user = database.prepare(`
    SELECT id, rm, name, email, role, active, is_dev, avatar
    FROM users WHERE rm = ? COLLATE NOCASE AND is_dev = 1
  `).get(rm.trim());
  if (!user || !user.active) {
    return response.status(401).json({ error: "RM dev incorreto." });
  }
  issueSession(user, response);
  response.json({ user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: publicUser(request.user) });
});

app.post("/api/auth/change-password", passwordChangeLimiter, async (request, response) => {
  const { rm, currentPassword, newPassword } = request.body || {};
  if (
    typeof rm !== "string" || !rmPattern.test(rm.trim()) ||
    typeof currentPassword !== "string" ||
    Buffer.byteLength(currentPassword, "utf8") > 72 ||
    typeof newPassword !== "string" ||
    !isValidPassword(newPassword)
  ) {
    return response.status(400).json({
      error: "Informe RM com 7 dígitos, senha atual e nova senha com pelo menos 12 caracteres.",
    });
  }

  const user = database.prepare(`
    SELECT id, password_hash FROM users
    WHERE rm = ? COLLATE NOCASE AND active = 1 AND is_dev = 0
  `).get(rm.trim());
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    return response.status(400).json({ error: "RM ou senha atual incorretos." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  database.prepare("UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?")
    .run(passwordHash, new Date().toISOString(), user.id);
  database.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  createActivity(user.id, "Senha alterada");
  response.json({ message: "Senha alterada com sucesso." });
});

app.post("/api/auth/password-reset/request", passwordResetRequestLimiter, async (request, response) => {
  const { rm } = request.body || {};
  if (typeof rm !== "string" || !rmPattern.test(rm.trim())) {
    return response.status(400).json({ error: "Informe um RM válido com 7 dígitos." });
  }
  const genericMessage =
    "Se houver uma conta ativa associada a esse RM, enviaremos um código ao e-mail institucional cadastrado.";
  const user = database.prepare(`
    SELECT id, email FROM users
    WHERE rm = ? COLLATE NOCASE AND active = 1 AND is_dev = 0
  `).get(rm.trim());
  if (!user) return response.json({ message: genericMessage });

  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  database.prepare(`
    INSERT INTO password_resets (user_id, token_hash, expires_at, attempts)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(user_id) DO UPDATE SET
      token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      attempts = 0
  `).run(user.id, codeHash, expiresAt);
  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (error) {
    database.prepare("DELETE FROM password_resets WHERE user_id = ? AND token_hash = ?")
      .run(user.id, codeHash);
    console.error("Unable to send password reset message.", error);
    return response.status(503).json({
      error: "Não foi possível enviar o código. Tente novamente mais tarde.",
    });
  }
  response.json({
    message: genericMessage,
    ...(exposePasswordResetCode && !mailer ? { resetCode: code } : {}),
  });
});

app.post("/api/auth/password-reset/confirm", passwordResetLimiter, async (request, response) => {
  const { rm, code, newPassword } = request.body || {};
  if (
    typeof rm !== "string" || !rmPattern.test(rm.trim()) ||
    typeof code !== "string" || !/^\d{6}$/.test(code) ||
    typeof newPassword !== "string" || !isValidPassword(newPassword)
  ) {
    return response.status(400).json({
      error: "Informe RM, código de 6 dígitos e senha com pelo menos 12 caracteres.",
    });
  }
  const reset = database.prepare(`
    SELECT password_resets.user_id, password_resets.token_hash,
      password_resets.expires_at, password_resets.attempts
    FROM password_resets
    JOIN users ON users.id = password_resets.user_id
    WHERE users.rm = ? COLLATE NOCASE AND users.active = 1 AND users.is_dev = 0
  `).get(rm.trim());
  const invalidCode = () => response.status(400).json({
    error: "Código inválido ou expirado. Solicite um novo código.",
  });
  if (!reset) return invalidCode();
  if (Date.parse(reset.expires_at) <= Date.now() || reset.attempts >= 5) {
    database.prepare("DELETE FROM password_resets WHERE user_id = ?").run(reset.user_id);
    return invalidCode();
  }
  if (!(await bcrypt.compare(code, reset.token_hash))) {
    database.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?")
      .run(reset.user_id);
    return invalidCode();
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const resetPassword = database.transaction(() => {
    const currentReset = database.prepare(`
      SELECT token_hash, expires_at, attempts FROM password_resets WHERE user_id = ?
    `).get(reset.user_id);
    if (
      !currentReset ||
      currentReset.token_hash !== reset.token_hash ||
      Date.parse(currentReset.expires_at) <= Date.now() ||
      currentReset.attempts >= 5
    ) return false;
    database.prepare("UPDATE users SET password_hash = ?, password_updated_at = ? WHERE id = ?")
      .run(passwordHash, new Date().toISOString(), reset.user_id);
    database.prepare("DELETE FROM password_resets WHERE user_id = ?").run(reset.user_id);
    database.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
    createActivity(reset.user_id, "Senha redefinida por recuperação de conta");
    return true;
  });
  if (!resetPassword()) return invalidCode();
  response.json({ message: "Senha redefinida com sucesso. Entre com sua nova senha." });
});

app.put("/api/auth/profile", requireAuth, (request, response) => {
  const { nome, foto } = request.body || {};
  const fields = Object.keys(request.body || {});
  if (
    fields.some((field) => !["nome", "foto"].includes(field)) ||
    typeof nome !== "string" || !nome.trim() || nome.trim().length > 120 ||
    (foto !== null && (
      typeof foto !== "string" ||
      foto.length > 245_760 ||
      !/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.test(foto)
    ))
  ) return response.status(400).json({ error: "Informe um nome válido e uma foto JPEG, PNG ou WebP de até 180 KB." });

  if (foto) {
    const [, mime, encoded] = foto.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    const image = Buffer.from(encoded, "base64");
    const hasSignature = mime === "jpeg"
      ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
      : mime === "png"
        ? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : image.subarray(0, 4).toString() === "RIFF" &&
          image.subarray(8, 12).toString() === "WEBP";
    if (image.length > 180 * 1024 || !hasSignature) {
      return response.status(400).json({ error: "A foto enviada é inválida ou excede 180 KB." });
    }
  }

  database.prepare("UPDATE users SET name = ?, avatar = ? WHERE id = ?")
    .run(nome.trim(), foto, request.user.id);
  createActivity(request.user.id, "Perfil atualizado");
  response.json({
    user: publicUser(findUserById.get(request.user.id)),
  });
});

app.post("/api/auth/logout", requireAuth, (request, response) => {
  const cookies = request.get("cookie") || "";
  const token = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  response.clearCookie(cookieName, { httpOnly: true, secure: production, sameSite: "lax", path: "/" });
  response.status(204).end();
});

app.get("/api/devices", requireAuth, (_request, response) => {
  const devices = database.prepare("SELECT * FROM devices ORDER BY name").all();
  response.json({ devices });
});

app.get("/api/rooms", requireAuth, (_request, response) => {
  const roomsList = database.prepare("SELECT * FROM rooms ORDER BY name").all();
  const inventoryDevices = database.prepare("SELECT name, location, total, available FROM devices ORDER BY name").all();
  const activeLoans = database.prepare(`
    ${loanSelect}
    WHERE loans.status = 'Em uso'
    ORDER BY loans.created_at DESC
  `).all().map(serializeLoan);
  const inventoryRooms = ["LMT", "Maker"].map((location) => ({
    id: `acervo-${location.toLowerCase()}`,
    name: location,
    kind: "Acervo",
    loans: [],
    devices: inventoryDevices
      .filter((device) => device.location.toLowerCase() === location.toLowerCase())
      .map((device) => `${device.available}/${device.total} ${device.name}`),
  }));
  response.json({
    rooms: [
      ...roomsList.map((room) => {
        const roomLoans = activeLoans.filter((loan) => loan.roomId === room.id);
        return {
          ...room,
          loans: roomLoans.map((loan) => ({
            id: loan.id,
            device: loan.device,
            qty: loan.qty,
            returnTime: loan.returnTime,
            status: loan.status,
          })),
          devices: roomLoans.length
            ? roomLoans.map((loan) => `${loan.qty} ${loan.device}`)
            : ["Livre"],
        };
      }),
      ...inventoryRooms,
    ],
  });
});

app.get("/api/loans", requireAuth, (request, response) => {
  const rows = database.prepare(`
    ${loanSelect}
    WHERE loans.status IN ('Pendente', 'Em uso', 'Recusado')
      AND (? = 1 OR loans.owner_id = ?)
    ORDER BY loans.created_at DESC
  `).all(adminRoles.has(request.user.role) ? 1 : 0, request.user.id);
  response.json({ loans: rows.map(serializeLoan) });
});

app.get("/api/history", requireAuth, (request, response) => {
  const rows = database.prepare(`
    ${loanSelect}
    WHERE loans.status = 'Devolvido'
      AND (? = 1 OR loans.owner_id = ?)
    ORDER BY loans.returned_at DESC
  `).all(adminRoles.has(request.user.role) ? 1 : 0, request.user.id);
  response.json({ history: rows.map(serializeLoan) });
});

app.delete("/api/admin/history", requireAuth, requireAdmin, (request, response) => {
  const clearReturnedHistory = database.transaction(() => {
    const { count } = database.prepare(
      "SELECT COUNT(*) AS count FROM loans WHERE status = 'Devolvido'",
    ).get();
    database.prepare("DELETE FROM loans WHERE status = 'Devolvido'").run();
    if (count > 0) {
      createActivity(request.user.id, `Histórico de empréstimos apagado (${count} registros)`);
    }
    return count;
  });
  const deletedCount = clearReturnedHistory();
  response.json({ deletedCount });
});

app.post("/api/loans", requireAuth, (request, response) => {
  const { deviceId, responsible, qty, roomId, returnAt } = request.body || {};
  const parsedDeviceId = positiveId(deviceId);
  const parsedQuantity = positiveId(qty);
  if (
    parsedDeviceId === null ||
    typeof responsible !== "string" ||
    !responsible.trim() ||
    parsedQuantity === null ||
    parsedQuantity > 10_000 ||
    responsible.trim().length > 120 ||
    typeof roomId !== "string" ||
    typeof returnAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(returnAt) ||
    !Number.isFinite(Date.parse(returnAt))
  ) {
    return response.status(400).json({ error: "Dados da solicitação inválidos." });
  }
  const [year, month, day] = returnAt.slice(0, 10).split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return response.status(400).json({ error: "A data de devolução é inválida." });
  }
  const dueAt = new Date(returnAt);
  if (dueAt.getTime() <= Date.now()) {
    return response.status(400).json({ error: "A data e hora de devolução devem ser futuras." });
  }
  const device = database.prepare("SELECT * FROM devices WHERE id = ?").get(parsedDeviceId);
  const room = database.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!device || !room) return response.status(404).json({ error: "Aparelho ou sala não encontrados." });
  if (!["LMT", "Maker"].includes(device.location)) {
    return response.status(409).json({
      error: "Este aparelho precisa ser associado ao acervo LMT ou Maker antes de ser emprestado.",
    });
  }
  if (room.kind !== "Sala de aula") {
    return response.status(400).json({ error: "Selecione uma sala de aula para utilizar o aparelho." });
  }

  const createdAt = new Date().toISOString();
  const returnTime = dueAt.toLocaleTimeString("pt-BR", {
    timeZone: schoolTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const createLoan = database.transaction(() => {
    const currentDevice = database.prepare("SELECT available, name FROM devices WHERE id = ?").get(device.id);
    if (parsedQuantity > currentDevice.available) {
      return { error: "Quantidade solicitada maior que a disponibilidade atual.", status: 409 };
    }

    const result = database.prepare(`
      INSERT INTO loans
        (owner_id, device_id, responsible, qty, room_id, department, created_at, return_time, due_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Em uso')
    `).run(
      request.user.id,
      device.id,
      responsible.trim().toUpperCase(),
      parsedQuantity,
      room.id,
      request.user.role,
      createdAt,
      returnTime,
      dueAt.toISOString(),
    );
    database.prepare("UPDATE devices SET available = available - ? WHERE id = ?")
      .run(parsedQuantity, device.id);
    createActivity(request.user.id, `Empréstimo registrado: ${currentDevice.name}`);
    return { id: Number(result.lastInsertRowid) };
  });

  const result = createLoan();
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(201).json({
    id: result.id,
    message: "Empréstimo registrado com sucesso.",
  });
});

app.post("/api/loans/:id/approve", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de solicitação inválido." });
  const approve = database.transaction(() => {
    const loan = database.prepare(`
      SELECT loans.*, devices.name AS device_name, devices.available
      FROM loans JOIN devices ON devices.id = loans.device_id
      WHERE loans.id = ? AND loans.status = 'Pendente'
    `).get(id);
    if (!loan) return { status: 404, error: "Solicitação pendente não encontrada." };
    if (loan.available < loan.qty) {
      return { status: 409, error: "Disponibilidade insuficiente para aprovar esta solicitação." };
    }
    database.prepare("UPDATE devices SET available = available - ? WHERE id = ?").run(loan.qty, loan.device_id);
    database.prepare(`
      UPDATE loans
      SET status = 'Em uso', reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(request.user.id, new Date().toISOString(), id);
    createActivity(request.user.id, `Solicitação aprovada: ${loan.device_name}`);
    return { status: 200 };
  });
  const result = approve();
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ message: "Solicitação aprovada." });
});

app.post("/api/loans/:id/reject", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de solicitação inválido." });
  const reject = database.transaction(() => {
    const loan = database.prepare(`
      SELECT loans.id, devices.name AS device_name
      FROM loans JOIN devices ON devices.id = loans.device_id
      WHERE loans.id = ? AND loans.status = 'Pendente'
    `).get(id);
    if (!loan) return false;
    database.prepare(`
      UPDATE loans
      SET status = 'Recusado', reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(request.user.id, new Date().toISOString(), id);
    createActivity(request.user.id, `Solicitação recusada: ${loan.device_name}`);
    return true;
  });
  if (!reject()) return response.status(404).json({ error: "Solicitação pendente não encontrada." });
  response.json({ message: "Solicitação recusada." });
});

app.post("/api/loans/:id/return", requireAuth, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de empréstimo inválido." });
  const returnLoan = database.transaction(() => {
    const loan = database.prepare(`
      SELECT loans.*, devices.name AS device_name, devices.total, rooms.name AS room_name
      FROM loans
      JOIN devices ON devices.id = loans.device_id
      JOIN rooms ON rooms.id = loans.room_id
      WHERE loans.id = ? AND loans.status = 'Em uso'
    `).get(id);
    if (!loan) return { status: 404, error: "Empréstimo ativo não encontrado." };
    if (!adminRoles.has(request.user.role) && loan.owner_id !== request.user.id) {
      return { status: 403, error: "Você só pode registrar a devolução dos seus empréstimos." };
    }
    const returnedAt = new Date().toISOString();
    database.prepare("UPDATE devices SET available = MIN(total, available + ?) WHERE id = ?").run(loan.qty, loan.device_id);
    database.prepare(`
      UPDATE loans SET status = 'Devolvido', returned_at = ?
      WHERE id = ?
    `).run(returnedAt, id);
    createActivity(request.user.id, `Devolução registrada: ${loan.device_name}`);
    return { status: 200 };
  });
  const result = returnLoan();
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ message: "Devolução registrada." });
});

app.post("/api/admin/devices", requireAuth, requireAdmin, (request, response) => {
  const { name, type, brand, total, location, tone, icon } = request.body || {};
  if (!isValidDevice({ name, type, brand, total }) || !["LMT", "Maker"].includes(location)) {
    return response.status(400).json({ error: "Dados do aparelho inválidos." });
  }
  try {
    const createDevice = database.transaction(() => {
      const result = database.prepare(`
        INSERT INTO devices (name, type, brand, total, available, tone, icon, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        type,
        brand.trim(),
        Number(total),
        Number(total),
        tone || "blue",
        icon || "▣",
        location,
      );
      createActivity(request.user.id, `Aparelho cadastrado: ${name.trim()}`);
      return Number(result.lastInsertRowid);
    });
    response.status(201).json({ id: createDevice() });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "Já existe um aparelho com esse nome." });
    }
    throw error;
  }
});

app.put("/api/admin/devices/:id", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de aparelho inválido." });
  const { name, type, brand, total, location, tone, icon } = request.body || {};
  if (!isValidDevice({ name, type, brand, total })) {
    return response.status(400).json({ error: "Dados inválidos ou total menor que as unidades já emprestadas." });
  }

  try {
    const updateDevice = database.transaction(() => {
      const current = database.prepare(
        "SELECT total, available, tone, icon, location FROM devices WHERE id = ?",
      ).get(id);
      if (!current) return { status: 404, error: "Aparelho não encontrado." };
      if (!["LMT", "Maker", current.location].includes(location)) {
        return {
          status: 400,
          error: "Selecione LMT ou Maker para classificar o local do aparelho.",
        };
      }
      const borrowed = current.total - current.available;
      if (Number(total) < borrowed) {
        return {
          status: 400,
          error: "O total não pode ser menor que as unidades já emprestadas.",
        };
      }
      database.prepare(`
        UPDATE devices
        SET name = ?, type = ?, brand = ?, total = ?, available = ?, location = ?, tone = ?, icon = ?
        WHERE id = ?
      `).run(
        name.trim(),
        type,
        brand.trim(),
        Number(total),
        Number(total) - borrowed,
        location,
        tone || current.tone,
        icon || current.icon,
        id,
      );
      createActivity(request.user.id, `Aparelho atualizado: ${name.trim()}`);
      return { success: true };
    });
    const result = updateDevice();
    if (result.error) return response.status(result.status).json({ error: result.error });
    response.json({ message: "Aparelho atualizado." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "Já existe um aparelho com esse nome." });
    }
    throw error;
  }
});

app.delete("/api/admin/devices/:id", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de aparelho inválido." });
  const deleteDevice = database.transaction(() => {
    const device = database.prepare("SELECT name FROM devices WHERE id = ?").get(id);
    if (!device) return { status: 404, error: "Aparelho não encontrado." };
    const hasLoanHistory = database.prepare(
      "SELECT EXISTS(SELECT 1 FROM loans WHERE device_id = ?) AS value",
    ).get(id).value === 1;
    if (hasLoanHistory) {
      return {
        status: 409,
        error: "O aparelho possui solicitações ou empréstimos no histórico e não pode ser removido.",
      };
    }
    database.prepare("DELETE FROM devices WHERE id = ?").run(id);
    createActivity(request.user.id, `Aparelho removido: ${device.name}`);
    return { success: true };
  });
  const result = deleteDevice();
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(204).end();
});

app.get("/api/admin/activities", requireAuth, requireAdmin, (_request, response) => {
  const activities = database.prepare(`
    SELECT activity_log.id, activity_log.message AS mensagem,
      users.name AS responsavel, activity_log.created_at AS createdAt
    FROM activity_log
    LEFT JOIN users ON users.id = activity_log.actor_id
    ORDER BY activity_log.id DESC LIMIT 200
  `).all().map((activity) => ({
    id: activity.id,
    mensagem: activity.mensagem,
    responsavel: activity.responsavel || "Sistema",
    data: formatInSchoolTime(new Date(activity.createdAt)),
  }));
  response.json({ activities });
});

app.get("/api/admin/users", requireAuth, requireAdmin, (_request, response) => {
  const users = database.prepare(`
    SELECT id, rm AS registro, name AS nome, email, role AS funcao,
      requested_admin_role AS requestedRole, active
    FROM users WHERE is_dev = 0 ORDER BY name
  `).all();
  response.json({ users });
});

app.put("/api/admin/users/:id/admin-role", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de conta inválido." });
  const approve = request.body?.approve;
  if (typeof approve !== "boolean") {
    return response.status(400).json({ error: "Informe se a solicitação deve ser aprovada." });
  }

  const target = database.prepare(`
    SELECT id, name, requested_admin_role FROM users
    WHERE id = ? AND is_dev = 0
  `).get(id);
  if (!target) return response.status(404).json({ error: "Conta não encontrada." });
  if (!adminRoles.has(target.requested_admin_role)) {
    return response.status(409).json({ error: "A conta não possui solicitação administrativa pendente." });
  }

  const role = approve ? target.requested_admin_role : "Outro";
  database.prepare(`
    UPDATE users SET role = ?, requested_admin_role = NULL WHERE id = ?
  `).run(role, id);
  createActivity(
    request.user.id,
    `Solicitação de acesso ${approve ? "aprovada" : "recusada"} para ${target.name} (${target.requested_admin_role})`,
  );
  response.json({
    message: approve ? "Acesso administrativo aprovado." : "Solicitação administrativa recusada.",
  });
});

app.post("/api/admin/rooms", requireAuth, requireAdmin, (request, response) => {
  const { name, kind, block } = request.body || {};
  if (!isValidClassroom({ name, kind, block })) {
    return response.status(400).json({ error: "Informe o nome, o tipo de sala e o bloco A ou B." });
  }

  const id = randomBytes(8).toString("hex");
  try {
    const createRoom = database.transaction(() => {
      const count = database.prepare(
        "SELECT COUNT(*) AS count FROM rooms WHERE block = ? AND kind = 'Sala de aula'",
      ).get(block).count;
      if (count >= 12) return { status: 409, error: `O Bloco ${block} já possui 12 salas.` };
      database.prepare("INSERT INTO rooms (id, name, kind, block) VALUES (?, ?, ?, ?)")
        .run(id, name.trim(), kind, block);
      createActivity(request.user.id, `Sala cadastrada: ${name.trim()} (Bloco ${block})`);
      return { id };
    });
    const result = createRoom();
    if (result.error) return response.status(result.status).json({ error: result.error });
    response.status(201).json({ id: result.id });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "Já existe um espaço com esse nome." });
    }
    throw error;
  }
});

app.put("/api/admin/rooms/:id", requireAuth, requireAdmin, (request, response) => {
  const { name, kind, block } = request.body || {};
  if (!isValidClassroom({ name, kind, block })) {
    return response.status(400).json({ error: "Informe o nome, o tipo de sala e o bloco A ou B." });
  }
  try {
    const updateRoom = database.transaction(() => {
      const current = database.prepare("SELECT id, block FROM rooms WHERE id = ?").get(request.params.id);
      if (!current) return { status: 404, error: "Sala não encontrada." };
      if (current.block !== block) {
        const count = database.prepare(
          "SELECT COUNT(*) AS count FROM rooms WHERE block = ? AND kind = 'Sala de aula'",
        ).get(block).count;
        if (count >= 12) return { status: 409, error: `O Bloco ${block} já possui 12 salas.` };
      }
      database.prepare("UPDATE rooms SET name = ?, kind = ?, block = ? WHERE id = ?")
        .run(name.trim(), kind, block, request.params.id);
      createActivity(request.user.id, `Sala atualizada: ${name.trim()} (Bloco ${block})`);
      return { success: true };
    });
    const result = updateRoom();
    if (result.error) return response.status(result.status).json({ error: result.error });
    response.json({ message: "Espaço atualizado." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "Já existe um espaço com esse nome." });
    }
    throw error;
  }
});

app.delete("/api/admin/rooms/:id", requireAuth, requireAdmin, (request, response) => {
  const deleteRoom = database.transaction(() => {
    const room = database.prepare("SELECT name FROM rooms WHERE id = ?").get(request.params.id);
    if (!room) return { status: 404, error: "Espaço não encontrado." };
    const hasLoanHistory = database.prepare(
      "SELECT EXISTS(SELECT 1 FROM loans WHERE room_id = ?) AS value",
    ).get(request.params.id).value === 1;
    if (hasLoanHistory) {
      return {
        status: 409,
        error: "O espaço está associado ao histórico de empréstimos e não pode ser removido.",
      };
    }
    database.prepare("DELETE FROM rooms WHERE id = ?").run(request.params.id);
    createActivity(request.user.id, `Espaço removido: ${room.name}`);
    return { success: true };
  });
  const result = deleteRoom();
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.status(204).end();
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (request, response) => {
  const { nome, email, funcao, rm, password } = request.body || {};
  if (!isValidAccount({ nome, email, funcao, rm, password })) {
    return response.status(400).json({ error: "Dados inválidos. Use RM de 7 dígitos, e-mail @senaisp.edu.br e senha com pelo menos 12 caracteres." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = database.prepare(`
      INSERT INTO users (rm, name, email, role, password_hash, email_verified, password_updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(rm.trim(), nome.trim(), email.trim().toLowerCase(), funcao, passwordHash, new Date().toISOString());
    createActivity(request.user.id, `Conta criada para ${nome.trim()} (${funcao})`);
    response.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "RM ou e-mail já cadastrado." });
    }
    throw error;
  }
});

app.put("/api/admin/users/:id/active", requireAuth, requireAdmin, (request, response) => {
  const id = positiveId(request.params.id);
  if (!id) return response.status(400).json({ error: "Identificador de conta inválido." });
  const active = request.body?.active;
  if (typeof active !== "boolean") return response.status(400).json({ error: "Informe o novo estado da conta." });
  if (id === request.user.id && !active) return response.status(400).json({ error: "Não é possível desativar sua própria conta." });
  if (!active) {
    const target = database.prepare("SELECT role, is_dev FROM users WHERE id = ?").get(id);
    if (target?.is_dev) {
      return response.status(400).json({ error: "Contas de desenvolvedor não podem ser gerenciadas por esta tela." });
    }
    if (target && adminRoles.has(target.role)) {
      const activeAdmins = database.prepare(`
        SELECT COUNT(*) AS count FROM users
        WHERE active = 1 AND is_dev = 0 AND role IN ('Diretoria', 'Secretaria', 'Orientador de Educação Digital')
      `).get().count;
      if (activeAdmins <= 1) {
        return response.status(409).json({ error: "O sistema precisa manter ao menos uma conta administrativa ativa." });
      }
    }
  }
  const result = database.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  if (!result.changes) return response.status(404).json({ error: "Conta não encontrada." });
  if (!active) database.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  createActivity(request.user.id, `Conta ${active ? "ativada" : "desativada"} (ID ${id})`);
  response.json({ message: `Conta ${active ? "ativada" : "desativada"}.` });
});

app.get("/api/health", (_request, response) => {
  database.prepare("SELECT 1").get();
  response.json({ status: "ok" });
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "Rota da API não encontrada." });
});

const distPath = path.join(projectRoot, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  console.error(error);
  if (response.headersSent) return;
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ error: "O corpo JSON da solicitação é inválido." });
  }
  response.status(500).json({ error: "Erro interno do servidor." });
});

const server = app.listen(port, host, () => {
  console.info(`Agenda LMT API listening on http://${host}:${port}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
