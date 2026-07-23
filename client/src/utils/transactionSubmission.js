import { submitWithTransactionDateGuard } from "./transactionDateValidation.js";

export const submitTransactionRequest = ({
  apiClient,
  date,
  now,
  payload,
  transactionId,
  type,
}) => {
  const collection = type === "income" ? "income" : "expenses";

  return submitWithTransactionDateGuard({
    date,
    now,
    submit: () =>
      transactionId
        ? apiClient.put(`/${collection}/${transactionId}`, payload)
        : apiClient.post(`/${collection}`, payload),
  });
};
