import { describe, expect, it } from 'vitest'
import { pageWindow } from './pagination'

describe('pageWindow', () => {
  it('mostra todas as páginas quando são poucas', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('usa reticências no meio', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20])
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20])
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20])
  })
})
