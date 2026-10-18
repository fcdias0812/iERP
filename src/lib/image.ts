/**
 * Recorta a imagem no centro (quadrado) e reduz para `size` px, no navegador.
 * Fotos (JPEG) saem em JPEG; PNG/WebP saem em PNG para manter a transparência.
 * Devolve uma data URL pronta para enviar à API (ou exibir).
 */
export async function squareImageDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  )
  bitmap.close()
  return file.type === 'image/jpeg'
    ? canvas.toDataURL('image/jpeg', 0.85)
    : canvas.toDataURL('image/png')
}
