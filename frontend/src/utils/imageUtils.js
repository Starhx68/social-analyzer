/**
 * Utility for image compression using Canvas
 */

export const compressImage = (file) => {
  return new Promise((resolve) => {
    // Canvas compression is disabled due to stability issues on mobile devices.
    // Returning original file directly.
    console.log('Canvas compression disabled, using original file');
    resolve(file);
  });
};
