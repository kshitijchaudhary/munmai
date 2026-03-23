import Income from "../models/Income.js";
import Expense from "../models/Expense.js";

export const getDashboardSummary = async (req, res) => {
  try {

    const userId = req.user.id;

    // TOTAL INCOME
    const incomeTotalResult = await Income.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const incomeTotal = incomeTotalResult[0]?.total || 0;

    // TOTAL EXPENSE
    const expenseTotalResult = await Expense.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const expenseTotal = expenseTotalResult[0]?.total || 0;

    // CATEGORY BREAKDOWN
    const categoryBreakdown = await Expense.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    const formattedCategories = categoryBreakdown.map(item => ({
      category: item._id,
      amount: item.amount
    }));

    res.json({
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
      categoryBreakdown: formattedCategories
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Dashboard error" });
  }
};