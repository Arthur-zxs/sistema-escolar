export default function exportarEmprestimos(loans, filename = "emprestimos-sesi.csv") {
  const linhas = [
    ["Aparelho", "Responsável", "Quantidade", "Sala", "Função", "Retirada", "Devolução prevista", "Status"],
    ...loans.map((loan) => [
      loan.device,
      loan.responsible || "Não informado",
      loan.qty,
      loan.room,
      loan.department || "Não informado",
      loan.date,
      loan.returnTime || "Não informado",
      loan.status,
    ]),
  ];
  const csv = `\uFEFF${linhas
    .map((linha) =>
      linha
        .map((valor) => {
          const text = String(valor ?? "");
          const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
          return `"${safeText.replaceAll('"', '""')}"`;
        })
        .join(";"),
    )
    .join("\r\n")}`;
  const arquivo = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
