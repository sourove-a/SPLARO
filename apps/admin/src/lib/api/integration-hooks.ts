'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAiIntegration,
  fetchIntegrations,
  fetchTelegramIntegration,
  testAiIntegration,
  testTelegramIntegration,
  updateAiIntegration,
  updateTelegramIntegration,
} from '@/lib/api/integrations'

export function useIntegrationsCatalog() {
  return useQuery({
    queryKey: ['integrations-catalog'],
    queryFn: fetchIntegrations,
    staleTime: 15_000,
    retry: 1,
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
      await qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export function useTestTelegramIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message?: string) => testTelegramIntegration(message),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['integration-telegram'] })
      await qc.invalidateQueries({ queryKey: ['integrations-catalog'] })
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
