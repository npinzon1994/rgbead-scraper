const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const sharp = require("sharp");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { processImage } = require("./matrix-transformations");

const app = express(); //this is the express app
const upload = multer(); //communicates between frontend and backend

app.use(cors()); //ensures the frontend can call this API without CORS issues
app.use(express.json()); // Automatically parses JSON in the request body

let scrapedColors = null;

app.get("/api/default-image", async (req, res) => {
  console.log("[Node] Received request at /api/default-image");
  const filePath = "./assets/felicia-darkstalkers.png";
  try {
    const imageBuffer = await sharp(filePath).toBuffer();
    const image = sharp(imageBuffer); // image created from uploaded pixel array
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const pixels = Array.from(data);
    const { updatedPixels, lookupTable_LabValues } = processImage(
      pixels,
      scrapedColors
    );
    console.log("UPDATED PIXELS: ", updatedPixels);

    res.json({
      width,
      height,
      originalPixels: pixels,
      updatedPixels,
      lookupTable_LabValues,
    });
    console.log("[Node] Response sent (default-image)");
  } catch (error) {
    return res.status(500).json("Error reading image");
  }
});

app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  console.log("Received request at /api/upload-image"); // Debugging log
  try {
    if (!scrapedColors || Object.keys(scrapedColors).length === 0) {
      return res
        .status(400)
        .json({ error: "No colors available. Scrape colors first!" });
    }
    if (!req.file) {
      return res.status(500).json({ error: "No image uploaded" });
    }
    const imageBuffer = req.file.buffer; //pixel array multer receives from client
    const image = sharp(imageBuffer); // image created from uploaded pixel array
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const pixels = Array.from(data);
    const { updatedPixels, lookupTable_LabValues } = processImage(
      pixels,
      scrapedColors
    );

    res.json({
      width,
      height,
      originalPixels: pixels,
      updatedPixels,
      lookupTable_LabValues,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json("Failed to process image");
  }
});

async function readJSONFiles(paths) {
  try {
    const fileContents = await Promise.all(
      paths.map(async (path) => {
        try {
          const data = await fs.promises.readFile(path, "utf8");
          console.log("Number of colors in file: ", data.length);
          return data;
        } catch (error) {
          console.error("Error reading file: ", error);
          return null;
        }
      })
    );

    const jsonData = fileContents
      .filter((data) => data !== null)
      .map((data) => JSON.parse(data));

    const mergedColorData = jsonData.reduce((acc, obj) => ({ ...acc, ...obj }));

    console.log("JSON Data: ", mergedColorData);

    return mergedColorData;
  } catch (error) {
    console.error("Error reading or parsing files:", error);
  }
}

app.post("/api/get-color-table", async (req, res) => {
  try {
    if (!req.body.selectedBrands) {
      return res
        .status(500)
        .json({ error: "No brands selected. Please select a brand!" });
    }

    const {
      perler: perlerChecked,
      artkal: artkalChecked,
      top_tier: top_tierChecked,
    } = req.body.selectedBrands;
    const beadSize = req.body.beadSize;

    //check brand
    //check bead size
    const perlers = perlerChecked
      ? path.join(__dirname, "data", `perler_${beadSize}.json`)
      : undefined;
    const artkals = artkalChecked
      ? path.join(__dirname, "data", `artkal_${beadSize}.json`)
      : undefined;
    const topTiers = top_tierChecked
      ? path.join(__dirname, "data", `top-tier_${beadSize}.json`)
      : undefined;

    const filePaths = [perlers, artkals, topTiers];
    if (!filePaths) {
      res.status(404).json({ error: "File path(s) not found." });
    }

    scrapedColors = await readJSONFiles(filePaths); //scraped colors

    if (!scrapedColors || Object.keys(scrapedColors).length === 0) {
      return res
        .status(400)
        .json({ error: "No colors available. Scrape colors first!" });
    }

    res.status(200).json(scrapedColors);
  } catch (error) {
    console.error(error);
    return res.status(500).json("Failed to get color table");
  }
});

app.get("/api/colors", async (req, res) => {
  console.log("[Node] Received request at /api/colors");
  //could get an error back so need try/catch
  try {
    const url =
      "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSRqGEhhyOK6pA0CWBGRU1AMPoe6AV2vDMcgw0bainqpv9-MEloTm5xR2NyaS-S3A44yXdicNksjao8/pubhtml/sheet?headers=false&gid=170380569";
    const { data } = await axios.get(url); //fetching webpage HTML from URL
    // console.log("Axios response data: ", data);
    const $ = cheerio.load(data); // loading the HTML for easy DOM traversal

    $("tr").each((_, tr) => {
      const $tr = $(tr); //wrap current <tr> in cheerio for further manipulation
      // const cells = $tr.find("td.s6, td.s8");
      const cells = $tr.filter(() => $(this).find("td").length === 7);
      const scrapedColor = {};
      const stringBuilder = []; //need for creating colorKey

      //looping over <td> elements (4 per row)
      cells.each((index, td) => {
        const cellData = $(td).text().trim();
        switch (index) {
          case 0:
            scrapedColor.name = cellData;
            break;
          case 2:
            scrapedColor.r = cellData;
            stringBuilder.push(`R${cellData}`);
            break;
          case 3:
            scrapedColor.g = cellData;
            stringBuilder.push(`G${cellData}`);
            break;
          case 4:
            scrapedColor.b = cellData;
            stringBuilder.push(`B${cellData}`);
            const colorKey = stringBuilder.join("");
            scrapedColor.key = colorKey;
            break;
        }
        scrapedColors.push(scrapedColor);
      });
    });
    if (!scrapedColors || Object.keys(scrapedColors).length === 0) {
      return res.status(400).json({ error: "No colors available" });
    }
    res.status(200).json(scrapedColors);
    console.log("[Node] Response sent (scraped colors)");
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: "Failed to fetch data." });
  }
});

module.exports = app;
