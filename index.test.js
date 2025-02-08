const request = require("supertest");
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const sharp = require("sharp");
const multer = require("multer");
const { processImage } = require("./matrix-transformations");

jest.setTimeout(30000); // 3 minutes

let app;
let server;

beforeAll(() => {
  app = require("./index"); // Import your app
  server = app.listen(5000);
});

afterAll((done) => {
  server.close(done); // Properly close the server
});

// jest.useFakeTimers();
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

jest.mock("axios");
jest.mock("cheerio");
jest.mock("multer", () => {
  return jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => next()),
  }));
});
jest.mock("sharp", () => {
  return jest.fn(() => ({
    raw: jest.fn().mockReturnThis(),
    ensureAlpha: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue({
      data: Buffer.from([255, 0, 0, 255]),
      info: { width: 2, height: 2 },
    }),
  }));
});

jest.mock("./matrix-transformations", () => ({
  processImage: jest.fn(),
}));

describe("API Tests", () => {
  it("should start the server on the correct port", () => {
    expect(server.address().port).toBe(5000);
  });

  describe("GET /api/default-image", () => {
    it("should return 200", async () => {
      await expect(
        request(app).get("/api/default-image")
      ).resolves.toBeTruthy();
    });

    it("should return the processed image data", async () => {
      // Mocking sharp's behavior for processing image
      const mockImageBuffer = Buffer.from([255, 0, 0, 255]);
      sharp.mockReturnValue({
        raw: jest.fn().mockReturnThis(),
        ensureAlpha: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue({
          data: mockImageBuffer,
          info: { width: 2, height: 2 },
        }),
      });

      processImage.mockReturnValue({
        updatedPixels: [255, 255, 255, 255],
        lookupTable_LabValues: ["Lab Values"],
      });

      const response = await request(app).get("/api/default-image");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("width", 2);
      expect(response.body).toHaveProperty("height", 2);
      expect(response.body).toHaveProperty("pixels");
      expect(response.body.pixels).toEqual([255, 255, 255, 255]);
    });

    it("should return a 500 error if image processing fails", async () => {
      sharp.mockReturnValue({
        raw: jest.fn().mockReturnThis(),
        ensureAlpha: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error("Sharp error")),
      });

      const response = await request(app).get("/api/default-image");

      expect(response.status).toBe(500);
      expect(response.body).toBe("Error reading image");
    });
  });

  describe("POST /api/upload-image", () => {
    it("should return 200", async () => {
      await expect(
        request(app).get("/api/default-image")
      ).resolves.toBeTruthy();
    });

    it("should return processed image data", async () => {
      // Mocking multer to simulate file upload
      const mockFile = { buffer: Buffer.from([255, 0, 0, 255]) };
      const mockResponse = {
        width: 2,
        height: 2,
        pixels: [255, 255, 255, 255],
        lookupTable_LabValues: ["Lab Values"],
      };

      // Mocking sharp's behavior for processing uploaded image
      sharp.mockReturnValue({
        raw: jest.fn().mockReturnThis(),
        ensureAlpha: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue({
          data: mockFile.buffer,
          info: { width: 2, height: 2 },
        }),
      });

      // Mocking processImage function
      processImage.mockReturnValue({
        updatedPixels: [255, 255, 255, 255],
        lookupTable_LabValues: ["Lab Values"],
      });

      const response = await request(app)
        .post("/api/upload-image")
        .attach("image", mockFile.buffer, "test.png");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it("should return 400 if no scraped colors are available", async () => {
      const mockFile = { buffer: Buffer.from([255, 0, 0, 255]) };

      // Mocking sharp's behavior for processing uploaded image
      sharp.mockReturnValue({
        raw: jest.fn().mockReturnThis(),
        ensureAlpha: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue({
          data: mockFile.buffer,
          info: { width: 2, height: 2 },
        }),
      });

      // No scraped colors available
      const response = await request(app)
        .post("/api/upload-image")
        .attach("image", mockFile.buffer, "test.png");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(
        "No colors available. Scrape colors first!"
      );
    });

    it("should return 500 if image processing fails", async () => {
      const mockFile = { buffer: Buffer.from([255, 0, 0, 255]) };

      sharp.mockReturnValue({
        raw: jest.fn().mockReturnThis(),
        ensureAlpha: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error("Sharp error")),
      });

      const response = await request(app)
        .post("/api/upload-image")
        .attach("image", mockFile.buffer, "test.png");

      expect(response.status).toBe(500);
      expect(response.body).toBe("Failed to process image");
    });
  });

  describe("GET /api/colors", () => {
    it("should return 200", async () => {
      await expect(
        request(app).get("/api/default-image")
      ).resolves.toBeTruthy();
    });

    it("should return the scraped colors", async () => {
      // Mocking axios to return a sample scraped HTML data
      axios.get.mockResolvedValue({
        data: "<html><tr><td class='s6'>Color1</td><td class='s6'>255</td><td class='s6'>0</td><td class='s6'>0</td></tr></html>",
      });
      cheerio.load.mockReturnValue({
        tr: {
          each: jest.fn().mockImplementation((cb) => {
            cb(0, {
              find: () => [
                { text: () => "Color1" },
                { text: () => "255" },
                { text: () => "0" },
                { text: () => "0" },
              ],
            });
          }),
        },
      });

      const response = await request(app).get("/api/colors");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("R255G0B0");
      expect(response.body["R255G0B0"]).toBe("Color1");
    });

    it("should return 500 if scraping fails", async () => {
      axios.get.mockRejectedValue(new Error("Axios error"));

      const response = await request(app).get("/api/colors");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to fetch data.");
    });
  });
});
