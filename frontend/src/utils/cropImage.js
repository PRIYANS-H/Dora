export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export default async function getCroppedImg(imageSrc, pixelCrop, options = {}) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) return null

  let destWidth = pixelCrop.width
  let destHeight = pixelCrop.height

  if (options.maxSize) {
    const max = Math.max(destWidth, destHeight)
    if (max > options.maxSize) {
      const scale = options.maxSize / max
      destWidth = Math.round(destWidth * scale)
      destHeight = Math.round(destHeight * scale)
    }
  }

  canvas.width = destWidth
  canvas.height = destHeight

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    destWidth,
    destHeight
  )

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file)
    }, 'image/jpeg', 0.9)
  })
}
