export async function resizeForListing(file: File) {
  let image: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};
  if ('createImageBitmap' in window) {
    const bitmap = await window.createImageBitmap(file);
    image = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(file);
    const element = new Image();
    await new Promise<void>((resolve, reject) => {
      element.onload = () => resolve();
      element.onerror = () => reject(new Error('This browser could not read the selected photo.'));
      element.src = objectUrl;
    });
    image = element;
    width = element.naturalWidth;
    height = element.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    cleanup();
    return file;
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  cleanup();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', 0.84));
}
