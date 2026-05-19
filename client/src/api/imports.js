import api from "./axios";

export const uploadImportCsv = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/imports/csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

export const previewBankStatementPdf = async (file) => {
  const formData = new FormData();
  formData.append("statement", file);

  const response = await api.post("/imports/bank/pdf/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

export const getImportBatches = async () => {
  const response = await api.get("/imports");
  return response.data;
};

export const getImportRows = async (batchId) => {
  const response = await api.get(`/imports/${batchId}/rows`);
  return response.data;
};

export const updateImportRow = async (rowId, payload) => {
  const response = await api.put(`/imports/rows/${rowId}`, payload);
  return response.data;
};

export const commitImportBatch = async (batchId) => {
  const response = await api.post(`/imports/${batchId}/commit`);
  return response.data;
};

export const deleteImportBatch = async (batchId) => {
  const response = await api.delete(`/imports/${batchId}`);
  return response.data;
};
