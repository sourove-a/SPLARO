import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { useAdminUiStore } from './uiStore'

function reset() {
  useAdminUiStore.setState({ agentChatOpen: false, notificationsOpen: false })
}

describe('assistant and notification tray are mutually exclusive', () => {
  beforeEach(reset)

  it('opening the tray closes the assistant', () => {
    useAdminUiStore.getState().setAgentChatOpen(true)
    useAdminUiStore.getState().setNotificationsOpen(true)

    const s = useAdminUiStore.getState()
    assert.equal(s.notificationsOpen, true)
    assert.equal(s.agentChatOpen, false)
  })

  it('opening the assistant closes the tray', () => {
    useAdminUiStore.getState().setNotificationsOpen(true)
    useAdminUiStore.getState().setAgentChatOpen(true)

    const s = useAdminUiStore.getState()
    assert.equal(s.agentChatOpen, true)
    assert.equal(s.notificationsOpen, false)
  })

  it('openAgentChat closes the tray too — row actions use this path, not the setter', () => {
    useAdminUiStore.getState().setNotificationsOpen(true)
    useAdminUiStore.getState().openAgentChat('why is this order late?', 'orders')

    const s = useAdminUiStore.getState()
    assert.equal(s.agentChatOpen, true)
    assert.equal(s.notificationsOpen, false)
    assert.equal(s.agentChatSeed, 'why is this order late?')
  })

  it('toggling the tray open closes the assistant', () => {
    useAdminUiStore.getState().setAgentChatOpen(true)
    useAdminUiStore.getState().toggleNotifications()

    const s = useAdminUiStore.getState()
    assert.equal(s.notificationsOpen, true)
    assert.equal(s.agentChatOpen, false)
  })

  it('toggling the tray shut leaves the assistant alone', () => {
    useAdminUiStore.getState().setNotificationsOpen(true)
    useAdminUiStore.getState().toggleNotifications()

    assert.equal(useAdminUiStore.getState().notificationsOpen, false)
    assert.equal(useAdminUiStore.getState().agentChatOpen, false)
  })

  it('closing one never reopens the other', () => {
    useAdminUiStore.getState().setAgentChatOpen(true)
    useAdminUiStore.getState().setAgentChatOpen(false)

    const s = useAdminUiStore.getState()
    assert.equal(s.agentChatOpen, false)
    assert.equal(s.notificationsOpen, false)
  })
})
