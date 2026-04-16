import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString()}`;

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
};

export const exportMonthlyPdf = ({
  userName = "User",
  monthLabel,
  monthlyIncome = 0,
  monthlyExpense = 0,
  monthlyBalance = 0,
  transactions = [],
}) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("Munmai", 14, 18);

  doc.setFontSize(16);
  doc.text("Personal finance and expense tracking application", 14, 28);

  doc.setFontSize(14);
  doc.text("Monthly Financial Summary", 14, 28);

  doc.setFontSize(11);
  doc.text(`User: ${userName}`, 14, 38);
  doc.text(`Month: ${monthLabel}`, 14, 45);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 52);

  doc.setFontSize(12);
  doc.text(`Monthly Income: ${formatCurrency(monthlyIncome)}`, 14, 65);
  doc.text(`Monthly Expense: ${formatCurrency(monthlyExpense)}`, 14, 73);
  doc.text(`Monthly Balance: ${formatCurrency(monthlyBalance)}`, 14, 81);

  const tableBody = transactions.map((item) => {
    const isIncome = !!item.source;

    return [
      formatDate(item.date),
      isIncome ? "Income" : "Expense",
      isIncome ? item.source || "-" : item.recipient || "-",
      item.category || "-",
      isIncome
        ? `+${formatCurrency(item.amount)}`
        : `-${formatCurrency(item.amount)}`,
      item.notes || "-",
    ];
  });

  autoTable(doc, {
    startY: 90,
    head: [["Date", "Type", "Title", "Category", "Amount", "Notes"]],
    body: tableBody.length
      ? tableBody
      : [["-", "-", "No transactions found", "-", "-", "-"]],
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
    },
  });

  const safeMonth = monthLabel.replace(/\s+/g, "-");
  const safeUser = userName.replace(/\s+/g, "-");

  doc.save(`${safeUser}-monthly-summary-${safeMonth}.pdf`);
};
