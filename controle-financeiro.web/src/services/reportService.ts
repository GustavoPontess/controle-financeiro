import { api } from "../api/axiosConfig";
import type { PeopleReport } from "../types/Report";

export const getReportByPeople = async (): Promise<PeopleReport> => {
  const res = await api.get("/relatorios/totais-por-pessoa");

  return res.data;
};
