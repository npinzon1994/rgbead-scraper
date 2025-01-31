const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const sharp = require("sharp");
const multer = require("multer");
const { processImage } = require("./matrix-transformations");

const app = express(); //this is the express app
const PORT = process.env.PORT || 5000; //in case we have an env variable
const upload = multer(); //communicates between frontend and backend

app.use(cors()); //ensures the frontend can call this API without CORS issues

const scrapedColors = {};

app.get("/api/default-image", async (req, res) => {
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

    return res.json({
      width,
      height,
      pixels: updatedPixels,
      lookupTable_LabValues,
    });
  } catch (error) {
    return res.status(500).json("Error reading image");
  }
});

app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (scrapedColors.length === 0) {
      return res
        .status(400)
        .json({ error: "No colors available. Scrape colors first!" });
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

    return res.json({
      width,
      height,
      pixels: updatedPixels,
      lookupTable_LabValues,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json("Failed to process image");
  }
});

app.get("/api/colors", async (req, res) => {
  //could get an error back so need try/catch
  try {
    const url =
      "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSRqGEhhyOK6pA0CWBGRU1AMPoe6AV2vDMcgw0bainqpv9-MEloTm5xR2NyaS-S3A44yXdicNksjao8/pubhtml/sheet?headers=false&gid=170380569";
    const { data } = await axios.get(url); //fetching webpage HTML from URL
    const $ = cheerio.load(data); // loading the HTML for easy DOM traversal

    console.log("Scraping web contents...");
    $("tr").each((_, tr) => {
      const $tr = $(tr); //wrap current <tr> in cheerio for further manipulation
      const cells = $tr.find("td.s6, td.s8");
      let currentColorName;
      const stringBuilder = []; //need for creating colorKey

      //looping over <td> elements (4 per row)
      cells.each((index, td) => {
        const cellData = $(td).text().trim();
        switch (index) {
          case 0:
            currentColorName = cellData;
            break;
          case 1:
            stringBuilder.push(`R${cellData}`);
            break;
          case 2:
            stringBuilder.push(`G${cellData}`);
            break;
          case 3:
            stringBuilder.push(`B${cellData}`);
            const colorKey = stringBuilder.join("");
            scrapedColors[colorKey] = currentColorName;
            break;
        }
      });
    });
    res.json(scrapedColors);
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: "Failed to fetch data." });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
