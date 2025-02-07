const {
    parseColors,
    toMatrix,
    RGBtoXYZ,
    RGBAtoXYZA,
    XYZtoLab,
    LabToXYZ,
    XYZtoRGB,
    processImage,
  } = require("./matrix-transformations");
  
  // Test parseColors
  describe('parseColors', () => {
    it('should parse an array of RGBA pixels into a unique set of colors', () => {
      const pixels = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];
      const result = parseColors(pixels);
      expect(Object.keys(result).length).toBe(3);
      expect(result['R255G0B0A255']).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });
  
    it('should ignore duplicate colors', () => {
      const pixels = [255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255];
      const result = parseColors(pixels);
      expect(Object.keys(result).length).toBe(1);
    });
  });
  
  // Test toMatrix
  describe('toMatrix', () => {
    it('should correctly convert RGBA array to matrix', () => {
      const rgbArray = [255, 0, 0, 255, 0, 255, 0, 255];
      const result = toMatrix(rgbArray);
      expect(result).toEqual([
        [255, 0],
        [0, 255],
        [0, 0],
        [255, 255],
      ]);
    });
  
    it('should correctly convert RGB array to matrix without alpha', () => {
      const rgbArray = [255, 0, 255, 255, 255, 0];
      const result = toMatrix(rgbArray, 'RGB');
      expect(result).toEqual([
        [255, 255],
        [0, 255],
        [255, 0],
      ]);
    });
  });
  
  // Test RGBtoXYZ
  describe('RGBtoXYZ', () => {
    it('should convert RGB to XYZ correctly', () => {
      const result = RGBtoXYZ([[255, 255, 255], [0, 0, 0], [0, 0, 0]]);
      expect(result).toBeInstanceOf(Array);
      expect(result[0][0]).toBeCloseTo(0.4124564, 4);
    });
  
    it('should throw an error if matrix multiplication is not possible', () => {
      const invalidRgb = [[1, 2], [3, 4]];
      expect(() => RGBtoXYZ(invalidRgb)).toThrowError(
        'Matrix multiplication not possible'
      );
    });
  });
  
  // Test RGBAtoXYZA
  describe('RGBAtoXYZA', () => {
    it('should convert RGBA values to XYZ correctly', () => {
      const r = [255, 255, 255, 255]
      const g = [0, 0, 0, 0]
      const b = [0, 0, 0, 0]
      const a = [255, 255, 255, 255]
      const result = RGBAtoXYZA([r, g, b]);
      expect(result).toHaveProperty('xyz');
      expect(result).toHaveProperty('a');
      expect(result.xyz).toEqual();
      expect(result.a).toBe(255);
    });
  });
  
  // Test XYZtoLab
  describe('XYZtoLab', () => {
    it('should correctly convert XYZ to Lab', () => {
      const xyz = { x: 0.4124564, y: 0.3575761, z: 0.1804375 };
      const result = XYZtoLab(xyz);
      expect(result).toHaveProperty('L');
      expect(result).toHaveProperty('a');
      expect(result).toHaveProperty('b');
    });
  });
  
  // Test LabToXYZ
  describe('LabToXYZ', () => {
    it('should correctly convert Lab to XYZ', () => {
      const lab = [50, 60, 70];
      const result = LabToXYZ(lab);
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('z');
    });
  });
  
  // Test XYZtoRGB
  describe('XYZtoRGB', () => {
    it('should correctly convert XYZ to RGB', () => {
      const xyz = { x: 0.3, y: 0.4, z: 0.2 };
      const result = XYZtoRGB(xyz);
      expect(result).toHaveProperty('r');
      expect(result).toHaveProperty('g');
      expect(result).toHaveProperty('b');
    });
  });
  
  // Test processImage
  describe('processImage', () => {
    it('should process the image and return updated pixels and lookup table', () => {
      const pixels = [255, 0, 0, 255, 0, 255, 0, 255];
      const scrapedColors = {
        R255G0B0A255: [255, 0, 0],
        R0G255B0A255: [0, 255, 0],
      };
      const result = processImage(pixels, scrapedColors);
      expect(result.updatedPixels).toBeInstanceOf(Array);
      expect(result.lookupTable_LabValues).toBeInstanceOf(Array);
    });
  
    it('should throw an error if the lookup table is empty', () => {
      const pixels = [255, 0, 0, 255];
      const scrapedColors = {};
      expect(() => processImage(pixels, scrapedColors)).toThrowError(
        'Lookup table cannot be empty'
      );
    });
  
    it('should handle edge case of empty pixels array', () => {
      const pixels = [];
      const scrapedColors = {
        R255G0B0A255: [255, 0, 0],
      };
      const result = processImage(pixels, scrapedColors);
      expect(result.updatedPixels).toEqual([]);
    });
  });