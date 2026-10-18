import { useEffect, useRef } from 'react'

export interface Hotkey {
  /** Tecla (`KeyboardEvent.key`, sem diferenciar maiúsculas): 'k', 'b', '?', 'n'. */
  key: string
  /** Ctrl no Windows/Linux ou Cmd no Mac. */
  mod?: boolean
  shift?: boolean
  /** Dispara mesmo com o foco num campo de texto (padrão: só atalhos com Ctrl/Cmd). */
  allowInInputs?: boolean
}

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

/**
 * Registra um atalho de teclado global. Atalhos de uma tecla só (ex.: "?" e "N")
 * não disparam enquanto a pessoa digita num campo.
 */
export function useHotkey(hotkey: Hotkey, handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing) return
      const mod = e.ctrlKey || e.metaKey
      if (Boolean(hotkey.mod) !== mod) return
      if (hotkey.shift !== undefined && hotkey.shift !== e.shiftKey) return
      if (e.altKey) return
      if (e.key.toLowerCase() !== hotkey.key.toLowerCase()) return
      const allowInInputs = hotkey.allowInInputs ?? Boolean(hotkey.mod)
      if (!allowInInputs && isEditable(e.target)) return
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey.key, hotkey.mod, hotkey.shift, hotkey.allowInInputs, enabled])
}
