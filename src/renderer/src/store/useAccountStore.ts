/**
 * Account Store - Manages accounts for prehrajto.cz
 */

import { create } from 'zustand'
import type { Account } from '../types'

interface AccountState {
  accounts: Account[]
  activeAccountId: string | null

  setAccounts: (accounts: Account[]) => void
  setActiveAccount: (accountId: string) => void
  updateAccount: (accountId: string, updates: Partial<Account>) => void
  addAccount: (account: Account) => void
  removeAccount: (accountId: string) => void
  getActiveAccount: () => Account | null
  getAccount: (accountId: string) => Account | undefined
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: null,

  setAccounts: (accounts) => set({ accounts }),

  setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

  updateAccount: (accountId, updates) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, ...updates } : acc
      )
    })),

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
      activeAccountId: state.activeAccountId ?? account.id
    })),

  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((acc) => acc.id !== accountId),
      activeAccountId:
        state.activeAccountId === accountId
          ? state.accounts.length > 1
            ? state.accounts.find((acc) => acc.id !== accountId)?.id ?? null
            : null
          : state.activeAccountId
    })),

  getActiveAccount: () => {
    const { accounts, activeAccountId } = get()
    return accounts.find((acc) => acc.id === activeAccountId) ?? null
  },

  getAccount: (accountId) => {
    const { accounts } = get()
    return accounts.find((acc) => acc.id === accountId)
  }
}))
