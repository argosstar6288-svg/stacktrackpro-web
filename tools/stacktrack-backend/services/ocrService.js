const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs/promises");
const { Jimp } = require("jimp");

async function preprocessImageForOcr(imagePath) {
  const image = await Jimp.read(imagePath);

  const targetWidth = Math.min(1800, Math.max(900, image.bitmap.width * 2));
  const targetHeight = Math.max(
    600,
    Math.round((targetWidth / image.bitmap.width) * image.bitmap.height)
  );

  image
    .resize(targetWidth, targetHeight)
    .greyscale()
    .contrast(0.35)
    .normalize();

  const outputPath = path.resolve(
    path.dirname(imagePath),
    `${path.basename(imagePath, path.extname(imagePath))}-ocr.jpg`
  );

  await image.write(outputPath);
  return outputPath;
}

const extractTextFromImage = async (imagePath) => {
  let processedPath = imagePath;

  try {
    processedPath = await preprocessImageForOcr(imagePath);
  } catch {
    processedPath = imagePath;
  }

  try {
    const result = await Tesseract.recognize(processedPath, "eng");
    return String(result?.data?.text || "").replace(/\s+/g, " ").trim();
  } finally {
    if (processedPath !== imagePath) {
      await fs.unlink(processedPath).catch(() => {});
    }
  }
};

module.exports = { extractTextFromImage };
