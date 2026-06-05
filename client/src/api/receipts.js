import api from "./axios";

export const uploadReceipt = async (formData) => {
  const response = await api.post("/receipt-inbox", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

export const getReceipts = async (params = {}) => {
  const response = await api.get("/receipt-inbox", { params });
  return response.data;
};

export const getReceipt = async (receiptId) => {
  const response = await api.get(`/receipt-inbox/${receiptId}`);
  return response.data;
};

export const updateReceipt = async (receiptId, payload) => {
  const response = await api.put(`/receipt-inbox/${receiptId}`, payload);
  return response.data;
};

export const archiveReceipt = async (receiptId) => {
  const response = await api.delete(`/receipt-inbox/${receiptId}`);
  return response.data;
};

export const getReceiptFile = async (receiptId) => {
  const response = await api.get(`/receipt-inbox/${receiptId}/file`, {
    responseType: "blob",
  });

  return response;
};
