import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import net from "node:net";
import { after, before, test } from "node:test";

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sesi-backend-"));
let serverProcess;
let baseUrl;
let adminCookie;
let staffCookie;
let serverEnvironment;
let port;
let testDatabasePath;

async function freePort() {
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = response.status === 204 ? null : await response.json();
  return { response, result };
}

async function waitForServer() {
  const timeout = Date.now() + 10_000;
  while (Date.now() < timeout) {
    if (serverProcess.exitCode !== null) {
      throw new Error("Backend process exited before becoming ready.");
    }
    try {
      const response = await fetch(`${baseUrl}/api/setup/status`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Backend server did not become ready in time.");
}

before(async () => {
  port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverEnvironment = {
    ...process.env,
    NODE_ENV: "test",
    TZ: "UTC",
    PORT: String(port),
    DATABASE_PATH: path.join(temporaryDirectory, "test.sqlite"),
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_FROM: "",
    EXPOSE_EMAIL_VERIFICATION_CODE: "true",
    BOOTSTRAP_ADMIN_RM: "1234567",
    BOOTSTRAP_ADMIN_NAME: "Administração de teste",
    BOOTSTRAP_ADMIN_EMAIL: "admin@senaisp.edu.br",
    BOOTSTRAP_ADMIN_PASSWORD: "AdminSenha#2026",
    BOOTSTRAP_ADMIN_ROLE: "Diretoria",
    DEV_ADMIN_RM: "4201",
  };
  testDatabasePath = serverEnvironment.DATABASE_PATH;
  await startServer();
});

async function startServer() {
  serverProcess = spawn(process.execPath, ["server/index.js"], {
    cwd: path.resolve("."),
    stdio: "ignore",
    env: serverEnvironment,
  });
  await waitForServer();
}

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
    await once(serverProcess, "exit");
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("authenticates, enforces admin permissions and persists lending workflows", async () => {
  const unauthenticated = await api("/api/devices");
  assert.equal(unauthenticated.response.status, 401);

  const adminRoleRequest = await api("/api/auth/register", {
    method: "POST",
    body: {
      nome: "Solicitante de diretoria",
      rm: "7654321",
      email: "user-admin@senaisp.edu.br",
      funcao: "Diretoria",
      password: "SenhaDiretoria#2026",
    },
  });
  assert.equal(adminRoleRequest.response.status, 201);
  assert.match(adminRoleRequest.result.message, /Confirme o código/);

  const pendingUserLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "7654321", password: "SenhaDiretoria#2026" },
  });
  assert.equal(pendingUserLogin.response.status, 403);
  const invalidEmailCode = await api("/api/auth/verify-email", {
    method: "POST",
    body: { email: "user-admin@senaisp.edu.br", code: "000000" },
  });
  assert.equal(invalidEmailCode.response.status, 400);
  const resendEmailCode = await api("/api/auth/resend-verification", {
    method: "POST",
    body: { email: "user-admin@senaisp.edu.br" },
  });
  assert.equal(resendEmailCode.response.status, 200);
  const verifiedDirectorEmail = await api("/api/auth/verify-email", {
    method: "POST",
    body: {
      email: "user-admin@senaisp.edu.br",
      code: resendEmailCode.result.verificationCode,
    },
  });
  assert.equal(verifiedDirectorEmail.response.status, 200);
  const verifiedDirectorLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "7654321", password: "SenhaDiretoria#2026" },
  });
  assert.equal(verifiedDirectorLogin.response.status, 200);
  assert.equal(verifiedDirectorLogin.result.user.funcao, "Diretoria");
  assert.equal(verifiedDirectorLogin.result.user.adminApprovalPending, true);
  const pendingUserCookie = verifiedDirectorLogin.response.headers.get("set-cookie").split(";")[0];
  const pendingAdminAttempt = await api("/api/admin/users", { cookie: pendingUserCookie });
  assert.equal(pendingAdminAttempt.response.status, 403);

  const validRegistration = {
    nome: "Usuário de teste",
    rm: "1111111",
    email: "usuario@senaisp.edu.br",
    funcao: "Professor(a)",
    password: "SenhaUsuario#2026",
  };
  for (const invalidRegistration of [
    { ...validRegistration, rm: "123456" },
    { ...validRegistration, email: "usuario@example.com" },
    { ...validRegistration, password: "senha123" },
  ]) {
    const invalidResponse = await api("/api/auth/register", {
      method: "POST",
      body: invalidRegistration,
    });
    assert.equal(invalidResponse.response.status, 400);
  }

  const validPublicRegistration = await api("/api/auth/register", {
    method: "POST",
    body: validRegistration,
  });
  assert.equal(validPublicRegistration.response.status, 201);
  const unverifiedLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "1111111", password: validRegistration.password },
  });
  assert.equal(unverifiedLogin.response.status, 403);
  const verifiedPublicEmail = await api("/api/auth/verify-email", {
    method: "POST",
    body: {
      email: validRegistration.email,
      code: validPublicRegistration.result.verificationCode,
    },
  });
  assert.equal(verifiedPublicEmail.response.status, 200);

  const adminLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "1234567", password: "AdminSenha#2026" },
  });
  assert.equal(adminLogin.response.status, 200);
  adminCookie = adminLogin.response.headers.get("set-cookie").split(";")[0];

  const pendingUsers = await api("/api/admin/users", { cookie: adminCookie });
  const directorRequest = pendingUsers.result.users.find((user) => user.registro === "7654321");
  assert.equal(directorRequest.requestedRole, "Diretoria");
  const roleApproval = await api(`/api/admin/users/${directorRequest.id}/admin-role`, {
    method: "PUT",
    cookie: adminCookie,
    body: { approve: true },
  });
  assert.equal(roleApproval.response.status, 200);
  const approvedAdminAttempt = await api("/api/admin/users", { cookie: pendingUserCookie });
  assert.equal(approvedAdminAttempt.response.status, 200);

  const secretaryRequest = await api("/api/auth/register", {
    method: "POST",
    body: {
      nome: "Solicitante de secretaria",
      rm: "6543210",
      email: "solicitante@senaisp.edu.br",
      funcao: "Secretaria",
      password: "SenhaSecretaria#2026",
    },
  });
  assert.equal(secretaryRequest.response.status, 201);
  const verifiedSecretaryEmail = await api("/api/auth/verify-email", {
    method: "POST",
    body: {
      email: "solicitante@senaisp.edu.br",
      code: secretaryRequest.result.verificationCode,
    },
  });
  assert.equal(verifiedSecretaryEmail.response.status, 200);
  const pendingUsersAfterSecretaryRequest = await api("/api/admin/users", {
    cookie: adminCookie,
  });
  const secretaryUser = pendingUsersAfterSecretaryRequest.result.users.find(
    (user) => user.registro === "6543210",
  );
  const declinedRoleRequest = await api(
    `/api/admin/users/${secretaryUser.id}/admin-role`,
    {
      method: "PUT",
      cookie: adminCookie,
      body: { approve: false },
    },
  );
  assert.equal(declinedRoleRequest.response.status, 200);
  const declinedUserLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "6543210", password: "SenhaSecretaria#2026" },
  });
  assert.equal(declinedUserLogin.result.user.funcao, "Outro");
  assert.equal(declinedUserLogin.result.user.adminApprovalPending, false);

  const createStaff = await api("/api/admin/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      nome: "Funcionário teste",
      rm: "2222222",
      email: "staff@senaisp.edu.br",
      funcao: "Professor(a)",
      password: "SenhaFuncionario#2026",
    },
  });
  assert.equal(createStaff.response.status, 201);

  const testDatabase = new Database(testDatabasePath);
  testDatabase.prepare("UPDATE users SET password_updated_at = NULL WHERE rm = ?").run("2222222");
  testDatabase.close();
  const legacyPasswordLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "2222222", password: "SenhaFuncionario#2026" },
  });
  assert.equal(legacyPasswordLogin.response.status, 428);
  const legacyPasswordUpdate = await api("/api/auth/change-password", {
    method: "POST",
    body: {
      rm: "2222222",
      currentPassword: "SenhaFuncionario#2026",
      newPassword: "SenhaLegadaAtualizada#2026",
    },
  });
  assert.equal(legacyPasswordUpdate.response.status, 200);

  const createDigitalStudiesAdvisor = await api("/api/admin/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      nome: "Orientador de Educação Digital",
      rm: "3333333",
      email: "orientador@senaisp.edu.br",
      funcao: "Orientador de Educação Digital",
      password: "SenhaOrientador#2026",
    },
  });
  assert.equal(createDigitalStudiesAdvisor.response.status, 201);
  const advisorLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "3333333", password: "SenhaOrientador#2026" },
  });
  assert.equal(advisorLogin.response.status, 200);
  const advisorCookie = advisorLogin.response.headers.get("set-cookie").split(";")[0];
  const advisorAdminUsers = await api("/api/admin/users", { cookie: advisorCookie });
  assert.equal(advisorAdminUsers.response.status, 200);

  const invalidAdminAccount = await api("/api/admin/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      nome: "Conta inválida",
      rm: "INVALID",
      email: "invalido@example.com",
      funcao: "Professor(a)",
      password: "senha-invalida",
    },
  });
  assert.equal(invalidAdminAccount.response.status, 400);

  const staffLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "2222222", password: "SenhaLegadaAtualizada#2026" },
  });
  assert.equal(staffLogin.response.status, 200);
  staffCookie = staffLogin.response.headers.get("set-cookie").split(";")[0];

  const invalidProfilePhoto = await api("/api/auth/profile", {
    method: "PUT",
    cookie: staffCookie,
    body: { nome: "Funcionário teste", foto: "data:image/svg+xml;base64,PHN2Zz4=" },
  });
  assert.equal(invalidProfilePhoto.response.status, 400);

  const forbiddenProfileField = await api("/api/auth/profile", {
    method: "PUT",
    cookie: staffCookie,
    body: {
      nome: "Funcionário teste",
      foto: null,
      email: "alterado@senaisp.edu.br",
    },
  });
  assert.equal(forbiddenProfileField.response.status, 400);

  const profilePhoto = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`;
  const profileUpdate = await api("/api/auth/profile", {
    method: "PUT",
    cookie: staffCookie,
    body: { nome: "Funcionário atualizado", foto: profilePhoto },
  });
  assert.equal(profileUpdate.response.status, 200);
  assert.equal(profileUpdate.result.user.nome, "Funcionário atualizado");
  assert.equal(profileUpdate.result.user.email, "staff@senaisp.edu.br");
  assert.equal(profileUpdate.result.user.foto, profilePhoto);
  const updatedProfile = await api("/api/auth/me", { cookie: staffCookie });
  assert.equal(updatedProfile.result.user.foto, profilePhoto);

  const rejectedPasswordChange = await api("/api/auth/change-password", {
    method: "POST",
    body: { rm: "2222222", currentPassword: "senha-incorreta", newPassword: "OutraSenha#2026" },
  });
  assert.equal(rejectedPasswordChange.response.status, 400);

  const rejectedInvalidPassword = await api("/api/auth/change-password", {
    method: "POST",
    body: { rm: "2222222", currentPassword: "SenhaLegadaAtualizada#2026", newPassword: "senha123" },
  });
  assert.equal(rejectedInvalidPassword.response.status, 400);

  const passwordChange = await api("/api/auth/change-password", {
    method: "POST",
    body: { rm: "2222222", currentPassword: "SenhaLegadaAtualizada#2026", newPassword: "OutraSenha#2026" },
  });
  assert.equal(passwordChange.response.status, 200);
  const invalidatedSession = await api("/api/devices", { cookie: staffCookie });
  assert.equal(invalidatedSession.response.status, 401);
  const oldPasswordLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "2222222", password: "SenhaLegadaAtualizada#2026" },
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "2222222", password: "OutraSenha#2026" },
  });
  assert.equal(newPasswordLogin.response.status, 200);
  staffCookie = newPasswordLogin.response.headers.get("set-cookie").split(";")[0];

  const forbiddenAdminAction = await api("/api/admin/devices", {
    method: "POST",
    cookie: staffCookie,
    body: {
      name: "Notebook não autorizado",
      type: "Notebook",
      brand: "Teste",
      total: 1,
      location: "Lab. 01",
    },
  });
  assert.equal(forbiddenAdminAction.response.status, 403);

  const rooms = await api("/api/rooms", { cookie: staffCookie });
  assert.ok(rooms.result.rooms.some((room) => room.name === "LMT" && room.kind === "Acervo"));
  assert.ok(rooms.result.rooms.some((room) => room.name === "Maker" && room.kind === "Acervo"));
  assert.ok(rooms.result.rooms.filter((room) => room.kind !== "Acervo")
    .every((room) => room.kind === "Sala de aula"));
  const classrooms = rooms.result.rooms.filter((room) => room.kind === "Sala de aula");
  assert.equal(classrooms.length, 24);
  assert.equal(classrooms.filter((room) => room.block === "A").length, 12);
  assert.equal(classrooms.filter((room) => room.block === "B").length, 12);
  const salaAulaId = classrooms.find((room) => room.id === "lab-04").id;

  const fullBlockRoomCreation = await api("/api/admin/rooms", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Sala extra", kind: "Sala de aula", block: "A" },
  });
  assert.equal(fullBlockRoomCreation.response.status, 409);

  const fullBlockMove = await api("/api/admin/rooms/lab-01", {
    method: "PUT",
    cookie: adminCookie,
    body: {
      name: "Sala 01 - Bloco A",
      kind: "Sala de aula",
      block: "B",
    },
  });
  assert.equal(fullBlockMove.response.status, 409);

  const invalidRoomKind = await api("/api/admin/rooms", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Espaço não permitido", kind: "Espaço comum", block: "A" },
  });
  assert.equal(invalidRoomKind.response.status, 400);

  const pastDueRequest = await api("/api/loans", {
    method: "POST",
    cookie: staffCookie,
    body: {
      deviceId: 1,
      responsible: "Funcionário teste",
      qty: 1,
      roomId: salaAulaId,
      returnAt: new Date(Date.now() - 60 * 1000).toISOString(),
    },
  });
  assert.equal(pastDueRequest.response.status, 400);

  const invalidCalendarDate = await api("/api/loans", {
    method: "POST",
    cookie: staffCookie,
    body: {
      deviceId: 1,
      responsible: "Funcionário teste",
      qty: 1,
      roomId: salaAulaId,
      returnAt: "2027-02-30T12:00:00.000Z",
    },
  });
  assert.equal(invalidCalendarDate.response.status, 400);

  const requestedReturnAt = new Date(Date.now() + 60 * 60 * 1000);
  const loanRequest = await api("/api/loans", {
    method: "POST",
    cookie: staffCookie,
    body: {
      deviceId: 1,
      responsible: "Funcionário teste",
      qty: 2,
      roomId: salaAulaId,
      returnAt: requestedReturnAt.toISOString(),
    },
  });
  assert.equal(loanRequest.response.status, 201);

  const requestedLoans = await api("/api/loans", { cookie: staffCookie });
  assert.equal(requestedLoans.result.loans[0].status, "Em uso");
  assert.equal(
    requestedLoans.result.loans[0].returnTime,
    requestedReturnAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  assert.match(requestedLoans.result.loans[0].date, /^\d{2}\/\d{2}\/\d{4} às /);
  const occupiedRooms = await api("/api/rooms", { cookie: staffCookie });
  const occupiedRoom = occupiedRooms.result.rooms.find((room) => room.id === salaAulaId);
  assert.equal(occupiedRoom.loans.length, 1);
  assert.equal(occupiedRoom.loans[0].id, loanRequest.result.id);
  assert.equal(occupiedRoom.loans[0].device, "Dell Latitude 5420");
  assert.equal(occupiedRoom.loans[0].qty, 2);
  assert.equal("responsible" in occupiedRoom.loans[0], false);

  const devices = await api("/api/devices", { cookie: staffCookie });
  assert.equal(devices.result.devices.find((device) => device.id === 1).available, 10);

  const returned = await api(`/api/loans/${loanRequest.result.id}/return`, {
    method: "POST",
    cookie: staffCookie,
  });
  assert.equal(returned.response.status, 200);

  const history = await api("/api/history", { cookie: staffCookie });
  assert.equal(history.result.history[0].status, "Devolvido");
  const forbiddenHistoryClear = await api("/api/admin/history", {
    method: "DELETE",
    cookie: staffCookie,
  });
  assert.equal(forbiddenHistoryClear.response.status, 403);

  const activeLoanBeforeHistoryClear = await api("/api/loans", {
    method: "POST",
    cookie: staffCookie,
    body: {
      deviceId: 1,
      responsible: "Funcionário teste",
      qty: 1,
      roomId: salaAulaId,
      returnAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(activeLoanBeforeHistoryClear.response.status, 201);
  const clearedHistory = await api("/api/admin/history", {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert.equal(clearedHistory.response.status, 200);
  assert.equal(clearedHistory.result.deletedCount, 1);
  const historyAfterClear = await api("/api/history", { cookie: adminCookie });
  assert.deepEqual(historyAfterClear.result.history, []);
  const loansAfterClear = await api("/api/loans", { cookie: staffCookie });
  assert.ok(loansAfterClear.result.loans.some(
    (loan) => loan.id === activeLoanBeforeHistoryClear.result.id && loan.status === "Em uso",
  ));
  const returnedActiveLoan = await api(
    `/api/loans/${activeLoanBeforeHistoryClear.result.id}/return`,
    { method: "POST", cookie: staffCookie },
  );
  assert.equal(returnedActiveLoan.response.status, 200);
  const secondHistoryClear = await api("/api/admin/history", {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert.equal(secondHistoryClear.result.deletedCount, 1);
  const returnedRooms = await api("/api/rooms", { cookie: staffCookie });
  assert.deepEqual(
    returnedRooms.result.rooms.find((room) => room.id === salaAulaId).loans,
    [],
  );

  const activities = await api("/api/admin/activities", { cookie: adminCookie });
  assert.ok(activities.result.activities.some((activity) => activity.mensagem.includes("Empréstimo registrado")));

  const finalAvailability = await api("/api/devices", { cookie: staffCookie });
  assert.equal(finalAvailability.result.devices.find((device) => device.id === 1).available, 12);

  const adminLoan = await api("/api/loans", {
    method: "POST",
    cookie: adminCookie,
    body: {
      deviceId: 1,
      responsible: "Administração de teste",
      qty: 1,
      roomId: salaAulaId,
      returnAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(adminLoan.response.status, 201);
  const adminLoanList = await api("/api/loans", { cookie: adminCookie });
  assert.equal(adminLoanList.result.loans[0].status, "Em uso");
  const adminAvailability = await api("/api/devices", { cookie: adminCookie });
  assert.equal(adminAvailability.result.devices.find((device) => device.id === 1).available, 11);
  const adminReturn = await api(`/api/loans/${adminLoan.result.id}/return`, {
    method: "POST",
    cookie: adminCookie,
  });
  assert.equal(adminReturn.response.status, 200);
});

test("developer admin access accepts only the configured 4-digit RM from loopback", async () => {
  const invalidRm = await api("/api/dev/auth/login", {
    method: "POST",
    body: { rm: "420" },
  });
  assert.equal(invalidRm.response.status, 400);

  const devLogin = await api("/api/dev/auth/login", {
    method: "POST",
    body: { rm: "4201" },
  });
  assert.equal(devLogin.response.status, 200);
  assert.equal(devLogin.result.user.isDeveloper, true);
  const devCookie = devLogin.response.headers.get("set-cookie").split(";")[0];
  const adminUsers = await api("/api/admin/users", { cookie: devCookie });
  assert.equal(adminUsers.response.status, 200);
  assert.ok(adminUsers.result.users.every((user) => user.registro !== "4201"));

  const blockedPasswordChange = await api("/api/auth/change-password", {
    method: "POST",
    body: {
      rm: "4201",
      currentPassword: "00000000",
      newPassword: "OutraSenha#2026",
    },
  });
  assert.equal(blockedPasswordChange.response.status, 400);
});

test("retains accounts, inventory and loan history after a server restart", async () => {
  serverProcess.kill("SIGTERM");
  await once(serverProcess, "exit");
  await startServer();

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { rm: "1234567", password: "AdminSenha#2026" },
  });
  assert.equal(login.response.status, 200);
  adminCookie = login.response.headers.get("set-cookie").split(";")[0];

  const inventory = await api("/api/devices", { cookie: adminCookie });
  assert.equal(inventory.result.devices.find((device) => device.id === 1).available, 12);
  assert.ok(inventory.result.devices.some((device) => device.name === "Dell Latitude 5420"));

  const persistedHistory = await api("/api/history", { cookie: adminCookie });
  assert.equal(persistedHistory.result.history[0].device, "Dell Latitude 5420");
});

test("limits repeated failed logins to a 30-second window", async () => {
  let response;
  let result;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    ({ response, result } = await api("/api/auth/login", {
      method: "POST",
      body: { rm: "9999999", password: "00000000" },
    }));
    if (response.status === 429) break;
    assert.equal(response.status, 401);
  }
  assert.equal(response.status, 429);
  assert.match(result.error, /30 segundos/);
});
