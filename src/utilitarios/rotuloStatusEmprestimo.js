export default function rotuloStatusEmprestimo(status) {
  return status === "Pendente" ? "Agendado" : status;
}
