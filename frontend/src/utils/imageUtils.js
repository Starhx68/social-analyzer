/**
 * Utility for image compression using Canvas
 */

export const compressImage = (file, maxWidth = 1920, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    // Canvas compression is disabled due to stability issues on mobile devices.
    // Returning original file directly.
    console.log('Canvas compression disabled, using original file');
    resolve(file);
  });
};
