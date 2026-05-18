import { api } from "../api/axiosConfig"
import type { OnboardingStatus } from "../types/Onboarding"

export const getOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const res = await api.get("/onboarding/status")
  return res.data
}

export const concluirOnboarding = async (): Promise<void> => {
  await api.post("/onboarding/concluir")
}
