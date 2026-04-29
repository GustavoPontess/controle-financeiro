import { api } from "../api/axiosConfig";
import type { Person } from "../types/Person";

export const getPeople = async (): Promise<Person[]> => {
  const response = await api.get("/pessoas");
  return response.data;
};

export const createPerson = async (person: Omit<Person, "id" | "idade">) => {
  const response = await api.post("/pessoas", person);
  return response.data;
};

export const updatePerson = async (id: string, person: Omit<Person, "id" | "idade">) => {
  await api.put(`/pessoas/${id}`, person);
};

export const deletePerson = async (id: string) => {
  await api.delete(`/pessoas/${id}`);
};
