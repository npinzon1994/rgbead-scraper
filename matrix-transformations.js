const KDTree = require("./kd-tree");

function parseColors(pixels) {
  const colors = {};
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    const colorKey = `R${r}G${g}B${b}A${a}`;

    if (!colors[colorKey]) {
      colors[colorKey] = { r, g, b, a };
    }
  }
  return colors;
}

function toMatrix(rgbArray, colorMode = "RGBA") {
  if (rgbArray.length % 3 !== 0 && rgbArray.length % 4 !== 0) {
    throw new Error("Invalid pixel data length. Image may be corrupted.");
  }

  const r = [];
  const g = [];
  const b = [];
  const a = [];

  //for converting values from IMAGE (accounting for transparent pixels)
  if (colorMode === "RGBA") {
    for (let i = 0; i < rgbArray.length; i += 4) {
      r.push(rgbArray[i]);
      g.push(rgbArray[i + 1]);
      b.push(rgbArray[i + 2]);
      a.push(rgbArray[i + 3]);
    }
  }

  //for converting values from WEB SCRAPER (their data omits alpha values)
  if (colorMode === "RGB") {
    for (let i = 0; i < rgbArray.length; i += 3) {
      r.push(rgbArray[i]);
      g.push(rgbArray[i + 1]);
      b.push(rgbArray[i + 2]);
    }
  }

  //only include alpha values if they exist
  return a.length > 0 ? [r, g, b, a] : [r, g, b];
}

function RGBAtoXYZA(rgbaMatrix) {
  //checking for empty input matrix
  if (
    rgbaMatrix.length === 4 &&
    (!Array.isArray(rgbaMatrix) ||
      rgbaMatrix.length < 3 ||
      rgbaMatrix.some((row) => !Array.isArray(row) || row.length === 0))
  ) {
    throw new Error("Input matrix cannot be empty");
  }

  if (
    rgbaMatrix.length === 3 &&
    (!Array.isArray(rgbaMatrix) ||
      rgbaMatrix.length < 3 ||
      rgbaMatrix.some((row) => !Array.isArray(row) || row.length === 0))
  ) {
    throw new Error("Lookup table cannot be empty");
  }

  const CONVERSION_MATRIX = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.072175],
    [0.0193339, 0.119192, 0.9503041],
  ];
  const r = rgbaMatrix[0];
  const g = rgbaMatrix[1];
  const b = rgbaMatrix[2];
  const a = rgbaMatrix.length === 4 ? rgbaMatrix[3] : Array(r.length).fill(255);

  const newMatrix_RGB = [r, g, b];

  const normalizedValues = newMatrix_RGB.map((innerArray) =>
    innerArray.map((value) => value / 255)
  );
  const linearizedValues = normalizedValues.map((innerArray) =>
    innerArray.map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    )
  );

  // Get dimensions of the matrices
  const rowsA = CONVERSION_MATRIX.length;
  const colsA = CONVERSION_MATRIX[0].length;
  const colsB = linearizedValues[0].length;

  // Initialize the result matrix with zeros (to ensure it isn't sparse)
  const result = Array(rowsA)
    .fill(null)
    .map(() => Array(colsB).fill(0));

  // Perform the matrix multiplication
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        //k keeps track of elements in dot product
        result[i][j] += CONVERSION_MATRIX[i][k] * linearizedValues[k][j];
      }
    }
  }
  return { xyz: result, a };
}

function transformationFunction_XYZtoLAB(t, delta = 6 / 29) {
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

function XYZtoLab(xyzPixel, whitePoint = { X: 95.0489, Y: 100.0, Z: 108.884 }) {
  const { x, y, z } = xyzPixel;

  //D65 reference white point
  const { X: Xn, Y: Yn, Z: Zn } = whitePoint;

  //X, Y, and Z come from matrix we get back from RGBtoXYZ conversion

  //Normalize XYZ by the reference white point
  const Xr = x / Xn;
  const Yr = y / Yn;
  const Zr = z / Zn;

  //apply transformation function
  const fX = transformationFunction_XYZtoLAB(Xr);
  const fY = transformationFunction_XYZtoLAB(Yr);
  const fZ = transformationFunction_XYZtoLAB(Zr);

  //calculate CIELAB values
  const L = 116 * fY - 16;
  const a = 500 * (fX - fY);
  const b = 200 * (fY - fZ);

  return { L, a, b };
}

function LabToXYZ(labPixel, whitePoint = { X: 95.047, Y: 100.0, Z: 108.883 }) {
  const L = labPixel[0];
  const a = labPixel[1];
  const b = labPixel[2];

  const { X: Xn, Y: Yn, Z: Zn } = whitePoint;

  // Reverse f(t) transformation
  const delta = 6 / 29;
  const fInverse = (t) => (t > delta ? t ** 3 : 3 * delta ** 2 * (t - 4 / 29));

  // Calculate fX, fY, and fZ
  const fY = (L + 16) / 116;
  const fX = fY + a / 500;
  const fZ = fY - b / 200;

  // Apply fInverse to get normalized Xr, Yr, Zr
  const Xr = fInverse(fX);
  const Yr = fInverse(fY);
  const Zr = fInverse(fZ);

  // Denormalize by multiplying with the reference white point
  const x = Xr * Xn;
  const y = Yr * Yn;
  const z = Zr * Zn;

  return { x, y, z };
}

function XYZtoRGB(xyzPixel) {
  const { x, y, z } = xyzPixel;

  // Transformation matrix for converting XYZ to linear RGB (sRGB D65)
  const M = [
    [3.2406, -1.5372, -0.4986],
    [-0.9689, 1.8758, 0.0415],
    [0.0557, -0.204, 1.057],
  ];

  // Convert XYZ to linear RGB
  const rLinear = M[0][0] * x + M[0][1] * y + M[0][2] * z;
  const gLinear = M[1][0] * x + M[1][1] * y + M[1][2] * z;
  const bLinear = M[2][0] * x + M[2][1] * y + M[2][2] * z;

  // Gamma correction function for sRGB
  const gammaCorrect = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  // Apply gamma correction and clamp values to the [0, 1] range
  const r = Math.min(Math.max(gammaCorrect(rLinear), 0), 1);
  const g = Math.min(Math.max(gammaCorrect(gLinear), 0), 1);
  const b = Math.min(Math.max(gammaCorrect(bLinear), 0), 1);

  // Scale to 8-bit RGB range [0, 255]
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function processImage(pixels, scrapedColors) {
  const colors = Object.values(parseColors(pixels)).flatMap(
    //from img - RGBA
    ({ r, g, b, a }) => [r, g, b, a]
  );

  //using this table because of new scrapedColors structure
  const table = Object.values(scrapedColors).flatMap((color) => [color.r, color.g, color.b]);

  //convert and transform
  const colorsMatrix_RGBA = toMatrix(colors);
  const colorsMatrix_XYZA = RGBAtoXYZA(colorsMatrix_RGBA);

  const lookupTableMatrix_RGB = toMatrix(table, "RGB");
  const lookupTableMatrix_XYZA = RGBAtoXYZA(lookupTableMatrix_RGB);

  //need to run the XYZ to Lab conversion for every pixel
  const colors_LabValues = [];
  for (let i = 0; i < colorsMatrix_XYZA.xyz[0].length; i++) {
    const pixel = [];
    for (let j = 0; j < colorsMatrix_XYZA.xyz.length; j++) {
      pixel.push(colorsMatrix_XYZA.xyz[j][i]);
    }
    const xyzPixel = {
      x: pixel[0],
      y: pixel[1],
      z: pixel[2],
    };
    const labPixel = Object.values(XYZtoLab(xyzPixel));
    colors_LabValues.push(labPixel);
  }

  //need to run the XYZ to Lab conversion for every pixel
  const lookupTable_LabValues = [];
  for (let i = 0; i < lookupTableMatrix_XYZA.xyz[0].length; i++) {
    const pixel = [];
    for (let j = 0; j < lookupTableMatrix_XYZA.xyz.length; j++) {
      pixel.push(lookupTableMatrix_XYZA.xyz[j][i]);
    }
    const xyzPixel = {
      x: pixel[0],
      y: pixel[1],
      z: pixel[2],
    };
    const labPixel = Object.values(XYZtoLab(xyzPixel));
    lookupTable_LabValues.push(labPixel);
  }

  //now find nearest neighbor
  const colorLookupTree = new KDTree(lookupTable_LabValues);

  const nuColors = [];
  for (let i = 0; i < colors_LabValues.length; i++) {
    const value = colors_LabValues[i];
    const labPixel = colorLookupTree.findNearestNeighbor(value).point;
    const xyzPixel = LabToXYZ(labPixel);
    const rgbaPixel = { ...XYZtoRGB(xyzPixel), a: colorsMatrix_RGBA[3][i] };
    nuColors.push(rgbaPixel);
  }

  const colorKeys = Object.keys(parseColors(pixels));
  const newColorKeys = nuColors.map(({ r, g, b, a }) => `R${r}G${g}B${b}A${a}`);

  const colorComparisonChart = {};
  for (let i = 0; i < colorKeys.length; i++) {
    colorComparisonChart[colorKeys[i]] = newColorKeys[i];
  }

  const updatedPixels = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const colorKey = `R${pixels[i]}G${pixels[i + 1]}B${pixels[i + 2]}A${
      pixels[i + 3]
    }`;

    const extractedValues = colorComparisonChart[colorKey]
      .match(/\d+/g)
      .map(Number);
    updatedPixels.push(
      extractedValues[0],
      extractedValues[1],
      extractedValues[2],
      extractedValues[3]
    );
  }
  return { updatedPixels, lookupTable_LabValues };
}

module.exports = {
  parseColors,
  toMatrix,
  RGBAtoXYZA,
  transformationFunction_XYZtoLAB,
  XYZtoLab,
  LabToXYZ,
  XYZtoRGB,
  processImage,
};
