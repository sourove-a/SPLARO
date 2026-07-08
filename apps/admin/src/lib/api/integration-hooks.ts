'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import {
  fetchAiIntegration,
  fetchIntegrations,
  fetchInfrastructureConfig,
  fetchPaymentIntegrations,
  fetchTelegramIntegration,
  fetchTelegramHealth,
  fetchTelegramLinkedAdmins,
  generateTelegramLinkToken,
  testAiIntegration,
  testInfrastructureIntegration,
  testMetaIntegration,
  testPaymentIntegration,
  testTelegramIntegration,
  unlinkTelegramAdmin,
  updateAiIntegration,
  updateInfrastructureConfig,
  updatePaymentIntegration,
  updateTelegramIntegration,
} from '@/lib/api/integrations'
import { testGoogleConnection } from '@/lib/api/google-workspace'

export function useIntegrationsCatalog() {
  return useQuery({
    queryKey: ['integrations-catalog'],
    queryFn: fetchIntegrations,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: (count, err) => {
      if (err instanceof ApiError && err.isAuthError) return false
      return count < 2
    },
  })
}

export function useTelegramIntegration() {
  return useQuery({
    queryKey: ['integration-telegram'],
    queryFn: fetchTelegramIntegration,
    staleTime: 0,
    retry: 1,
  })
}

export function useUpdateTelegramIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateTelegramIntegration,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-telegram'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
      await qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}

export function useTestMetaIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: testMetaIntegration,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
      await qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}

export function useTestTelegramIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message?: string) => testTelegramIntegration(message),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-telegram'] })
      await qc.invalidateQueries({ queryKey: ['integration-telegram-health'] })
      await qc.invalidateQueries({ queryKey: ['integration-telegram-linked'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function useTelegramHealth() {
  return useQuery({
    queryKey: ['integration-telegram-health'],
    queryFn: fetchTelegramHealth,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useTelegramLinkedAdmins() {
  return useQuery({
    queryKey: ['integration-telegram-linked'],
    queryFn: fetchTelegramLinkedAdmins,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useGenerateTelegramLinkToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: generateTelegramLinkToken,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-telegram-linked'] })
      await qc.invalidateQueries({ queryKey: ['integration-telegram-health'] })
    },
  })
}

export function useUnlinkTelegramAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlinkTelegramAdmin,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-telegram-linked'] })
      await qc.invalidateQueries({ queryKey: ['integration-telegram-health'] })
    },
  })
}

export function useAiIntegration() {
  return useQuery({
    queryKey: ['integration-ai'],
    queryFn: fetchAiIntegration,
    staleTime: 0,
    retry: 1,
  })
}

export function useUpdateAiIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAiIntegration,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-ai'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
      await qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}

export function useTestAiIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: testAiIntegration,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-ai'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function useTestGoogleIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode?: 'gmail' | 'sheets' | 'auto') => testGoogleConnection(mode),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['google-workspace'] })
      await qc.invalidateQueries({ queryKey: ['google-gmail'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function usePaymentIntegrations() {
  return useQuery({
    queryKey: ['payment-integrations'],
    queryFn: fetchPaymentIntegrations,
    staleTime: 10_000,
  })
}

export function useUpdatePaymentIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ provider, body }: { provider: string; body: Record<string, string | boolean> }) =>
      updatePaymentIntegration(provider, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['payment-integrations'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function useTestPaymentIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: string) => testPaymentIntegration(provider),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['payment-integrations'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function useInfrastructureConfig(provider: 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx') {
  return useQuery({
    queryKey: ['infrastructure-config', provider],
    queryFn: () => fetchInfrastructureConfig(provider),
    staleTime: 10_000,
  })
}

export function useUpdateInfrastructureConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      provider,
      body,
    }: {
      provider: 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx'
      body: Record<string, string>
    }) => updateInfrastructureConfig(provider, body),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ['infrastructure-config', vars.provider] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}

export function useTestInfrastructureIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: 'pathao' | 'redx') => testInfrastructureIntegration(provider),
    onSuccess: async (_, provider) => {
      await qc.invalidateQueries({ queryKey: ['infrastructure-config', provider] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
    },
  })
}
