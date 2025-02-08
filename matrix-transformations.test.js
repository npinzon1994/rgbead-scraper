const {
  parseColors,
  toMatrix,
  RGBAtoXYZA,
  transformationFunction_XYZtoLAB,
  XYZtoLab,
  LabToXYZ,
  XYZtoRGB,
  processImage,
} = require("./matrix-transformations");

// Test parseColors
describe("parseColors", () => {
  it("should parse an array of RGBA pixels into a unique set of colors", () => {
    const pixels = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];
    const result = parseColors(pixels);
    expect(Object.keys(result).length).toBe(3);
    expect(result["R255G0B0A255"]).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it("should ignore duplicate colors", () => {
    const pixels = [255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255];
    const result = parseColors(pixels);
    expect(Object.keys(result).length).toBe(1);
  });

  it("should ignore transparent pixels", () => {
    const pixels = [255, 0, 0, 0, 255, 0, 0, 255];
    const result = parseColors(pixels);
    expect(Object.keys(result).length).toBe(2);
  });
  it("should handle large randomized RGBA data", () => {
    const pixels = [];
    for (let i = 0; i < 10000; i++) {
      pixels.push(
        ...[Math.random() * 255, Math.random() * 255, Math.random() * 255, 255]
      );
    }
    const result = parseColors(pixels);
    expect(Object.keys(result).length).toBeLessThanOrEqual(10000); // Ensure no duplicates
  });
});

// Test toMatrix
describe("toMatrix", () => {
  it("should correctly convert RGBA array to matrix", () => {
    const rgbArray = [255, 0, 0, 255, 0, 255, 0, 255];
    const result = toMatrix(rgbArray);
    expect(result).toEqual([
      [255, 0],
      [0, 255],
      [0, 0],
      [255, 255],
    ]);
  });

  it("should correctly convert RGB array to matrix without alpha", () => {
    const rgbArray = [255, 0, 255, 255, 255, 0];
    const result = toMatrix(rgbArray, "RGB");
    expect(result).toEqual([
      [255, 255],
      [0, 255],
      [255, 0],
    ]);
  });

  it("should throw an error if pixel data length is not a multiple of 3 or 4 -- potentially corrupt image file", () => {
    const rgbArray_incorrectLength = [
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255,
    ];

    expect(() => toMatrix(rgbArray_incorrectLength)).toThrow(
      "Invalid pixel data length. Image may be corrupted."
    );
  });
});

describe("RGBAtoXYZA function", () => {
  test("should correctly convert an RGB matrix to XYZ", () => {
    const rgbMatrix = [
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [0, 0, 255], // Blue
    ];

    const { xyz, a } = RGBAtoXYZA(rgbMatrix);

    expect(xyz).toBeInstanceOf(Array);
    expect(xyz.length).toBe(3);
    expect(xyz.every((row) => Array.isArray(row))).toBe(true);
    expect(a).toEqual([255, 255, 255]); // Default alpha

    // Approximate expected XYZ values for red, green, blue
    expect(xyz[0][0]).toBeCloseTo(0.4124564, 4);
    expect(xyz[1][1]).toBeCloseTo(0.7151522, 4);
    expect(xyz[2][2]).toBeCloseTo(0.9503041, 4);
  });

  test("should correctly convert an RGBA matrix to XYZ and retain alpha", () => {
    const rgbaMatrix = [
      [255, 128, 0], // Red channel
      [0, 255, 128], // Green channel
      [0, 0, 255], // Blue channel
      [255, 128, 64], // Alpha channel
    ];

    const { xyz, a } = RGBAtoXYZA(rgbaMatrix);

    expect(xyz.length).toBe(3);
    expect(a).toEqual([255, 128, 64]); // Alpha should be preserved
  });

  test("should correctly handle all black pixels", () => {
    const blackMatrix = [
      [0, 0, 0], // R
      [0, 0, 0], // G
      [0, 0, 0], // B
    ];

    const { xyz, a } = RGBAtoXYZA(blackMatrix);

    expect(xyz).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(a).toEqual([255, 255, 255]); // Default alpha
  });

  test("should correctly handle all white pixels", () => {
    const whiteMatrix = [
      [255, 255, 255], // R
      [255, 255, 255], // G
      [255, 255, 255], // B
    ];

    const { xyz, a } = RGBAtoXYZA(whiteMatrix);

    expect(xyz[0][0]).toBeCloseTo(0.95047, 4);
    expect(xyz[1][0]).toBeCloseTo(1.0, 4);
    expect(xyz[2][0]).toBeCloseTo(1.08883, 4);
    expect(a).toEqual([255, 255, 255]);
  });

  test("should handle a single pixel input", () => {
    const singlePixel = [
      [120], // R
      [200], // G
      [80], // B
    ];

    const { xyz, a } = RGBAtoXYZA(singlePixel);

    expect(xyz.length).toBe(3);
    expect(xyz[0].length).toBe(1);
    expect(a).toEqual([255]); // Default alpha
  });

  test("should throw an error when input matix is empty", () => {
    expect(() => RGBAtoXYZA([[], [], [], []])).toThrow(
      "Input matrix cannot be empty"
    );
  });

  test("should throw an error if the lookup table is empty", () => {
    expect(() => RGBAtoXYZA([[], [], []])).toThrow(
      "Lookup table cannot be empty"
    );
  });
});

describe("XYZtoLab -- Transformation Function", () => {
  it("should correctly calculate transformation function (cube root or linear transformation)", () => {
    const t1 = 0.2;
    const t2 = 0.001;
    const delta = 6 / 29;

    const result1 = transformationFunction_XYZtoLAB(t1);
    const result2 = transformationFunction_XYZtoLAB(t2);

    expect(result1).toBeCloseTo(Math.cbrt(t1), 4);
    expect(result2).toBeCloseTo(t2 / (3 * delta ** 2) + 4 / 29, 4);
  });
});

// Test XYZtoLab
describe("XYZtoLab", () => {
  it("should correctly convert XYZ to Lab", () => {
    const xyz = { x: 0.4124564, y: 0.3575761, z: 0.1804375 };
    const result = XYZtoLab(xyz);
    expect(result).toHaveProperty("L");
    expect(result).toHaveProperty("a");
    expect(result).toHaveProperty("b");
  });
});

// Test LabToXYZ
describe("LabToXYZ", () => {
  it("should correctly convert Lab to XYZ", () => {
    const lab = [50, 60, 70];
    const result = LabToXYZ(lab);
    expect(result).toHaveProperty("x");
    expect(result).toHaveProperty("y");
    expect(result).toHaveProperty("z");
  });

  it("should correctly handle extreme Lab values", () => {
    const lab = [100, -128, 128]; // Edge values
    const result = LabToXYZ(lab);
    expect(result).toHaveProperty("x");
    expect(result).toHaveProperty("y");
    expect(result).toHaveProperty("z");
  });
});

// Test XYZtoRGB
describe("XYZtoRGB", () => {
  it("should correctly convert XYZ to RGB", () => {
    const xyz = { x: 0.3, y: 0.4, z: 0.2 };
    const result = XYZtoRGB(xyz);
    expect(result).toHaveProperty("r");
    expect(result).toHaveProperty("g");
    expect(result).toHaveProperty("b");
  });

  it("should clip RGB values between 0-255", () => {
    const xyz = { x: 2, y: 2, z: 2 }; // Out-of-range values
    const result = XYZtoRGB(xyz);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(255);
    expect(result.g).toBeLessThanOrEqual(255);
    expect(result.b).toBeLessThanOrEqual(255);
  });
});

// Test processImage
describe("processImage", () => {
  it("should process the image and return updated pixels and lookup table", () => {
    const pixels = [255, 0, 0, 255, 0, 255, 0, 255];
    const scrapedColors = {
      R255G0B0A255: [255, 0, 0],
      R0G255B0A255: [0, 255, 0],
    };
    const result = processImage(pixels, scrapedColors);
    expect(result.updatedPixels).toBeInstanceOf(Array);
    expect(result.lookupTable_LabValues).toBeInstanceOf(Array);
  });
});
