import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILD_ATUAL, buildPublicado, haVersaoNova } from './atualizacao'

describe('versão nova do sistema', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('só é nova quando o servidor responde um build diferente do desta página', () => {
    expect(BUILD_ATUAL).toBe('teste')
    expect(haVersaoNova('teste')).toBe(false)
    expect(haVersaoNova(null)).toBe(false)
    expect(haVersaoNova('2026-10-28T15:00:00.000Z')).toBe(true)
  })

  it('lê o version.json sem cache; erro ou resposta estranha = sem informação', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ build: 'b2' }))
    vi.stubGlobal('fetch', fetch)
    expect(await buildPublicado()).toBe('b2')
    expect(String(fetch.mock.calls[0]![0])).toMatch(/version\.json\?t=\d+$/)
    expect(fetch.mock.calls[0]![1]).toMatchObject({ cache: 'no-store' })

    fetch.mockResolvedValueOnce(new Response('?', { status: 404 }))
    expect(await buildPublicado()).toBeNull()
    fetch.mockResolvedValueOnce(Response.json({ outra: 1 }))
    expect(await buildPublicado()).toBeNull()
    fetch.mockRejectedValueOnce(new Error('rede'))
    expect(await buildPublicado()).toBeNull()
  })
})
