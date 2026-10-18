import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge configurado com a escala do design system
 * (text-12…text-30 e sombras card/popover/modal), para não confundir
 * `text-14` (tamanho) com `text-foreground` (cor).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['12', '13', '14', '16', '18', '20', '24', '30'],
      shadow: ['card', 'popover', 'modal'],
    },
    classGroups: {
      'font-size': [
        {
          type: [
            'display',
            'page-title',
            'section-title',
            'card-title',
            'body',
            'label',
            'caption',
            'overline',
          ],
        },
      ],
    },
  },
})

/** Junta classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
