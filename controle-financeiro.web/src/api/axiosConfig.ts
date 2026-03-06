import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5296/api",
});