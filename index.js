const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const sharp = require("sharp");
const multer = require("multer");

const {
  parseColors,
  toMatrix,
  RGBtoXYZ,
  RGBAtoXYZA,
  XYZtoLab,
  LabToXYZ,
  XYZtoRGB,
} = require("./matrix-transformations");

const KDTree = require("./kd-tree");

const app = express(); //this is the express app
const PORT = process.env.PORT || 5000; //in case we have an env variable
const upload = multer(); //communicates between frontend and backend

app.use(cors()); //ensures the frontend can call this API without CORS issues

const scrapedColors = {};

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
    // console.log("ORIGINAL PIXEL ARRAY: ", pixels);

    const parsedColors = parseColors(pixels);
    // console.log("Parsed Colors (Objects): ", parsedColors);

    const colors = Object.values(parsedColors).flatMap(({ r, g, b, a }) => [
      r,
      g,
      b,
      a,
    ]);
    // console.log("Colors Stream FROM PIXEL ARRAY: ", colors);

    const lookupTable = Object.keys(scrapedColors).flatMap((colorKey) => {
      const extractedValues = colorKey.match(/\d+/g).map(Number);
      return [extractedValues[0], extractedValues[1], extractedValues[2]];
    });
    // console.log("Lookup Table FROM SCRAPED COLORS: ", lookupTable);

    //convert and transform
    const colorsMatrix_RGBA = toMatrix(colors);
    // console.log("Colors RGBA Matrix: ", colorsMatrix_RGBA);

    const xyzaObject = RGBAtoXYZA(colorsMatrix_RGBA);
    const { xyz: colorsMatrix_XYZ, a: alphaValues } = xyzaObject;

    // console.log("Colors XYZ Matrix: ", colorsMatrix_XYZ);

    const lookupTableMatrix_RGB = toMatrix(lookupTable);
    const lookupTableMatrix_XYZ = RGBtoXYZ(lookupTableMatrix_RGB);

    //need to run the XYZ to Lab conversion for every pixel
    const colors_LabValues = [];
    for (let i = 0; i < colorsMatrix_XYZ[0].length; i++) {
      const pixel = [];
      for (let j = 0; j < colorsMatrix_XYZ.length; j++) {
        pixel.push(colorsMatrix_XYZ[j][i]);
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
    for (let i = 0; i < lookupTableMatrix_XYZ[0].length; i++) {
      const pixel = [];
      for (let j = 0; j < lookupTableMatrix_XYZ.length; j++) {
        pixel.push(lookupTableMatrix_XYZ[j][i]);
      }
      const xyzPixel = {
        x: pixel[0],
        y: pixel[1],
        z: pixel[2],
      };
      const labPixel = Object.values(XYZtoLab(xyzPixel));
      lookupTable_LabValues.push(labPixel);
    }

    // console.log("Colors Lab Values", colors_LabValues);
    // console.log("Lab values -- LOOKUP TABLE", lookupTable_LabValues);

    //now find nearest neighbor
    const colorLookupTree = new KDTree(lookupTable_LabValues);

    //[[L, a, b, A], [L, a, b, A], ...]
    const newColors = colors_LabValues.map((value) => {
      //array of objects
      //only run NN when pixel is NOT TRANSPARENT
      const labPixel = colorLookupTree.findNearestNeighbor(value).point;
      const xyzPixel = LabToXYZ(labPixel);
      return XYZtoRGB(xyzPixel);
    });

    const nuColors = [];
    for (let i = 0; i < colors_LabValues.length; i++) {
      const value = colors_LabValues[i];
      const labPixel = colorLookupTree.findNearestNeighbor(value).point;
      const xyzPixel = LabToXYZ(labPixel);
      const rgbaPixel = { ...XYZtoRGB(xyzPixel), a: alphaValues[i] };
      nuColors.push(rgbaPixel);
    }

    console.log("Nu colors: ", nuColors);

    const colorKeys = Object.keys(parseColors(pixels));
    const newColorKeys = nuColors.map(
      ({ r, g, b, a }) => `R${r}G${g}B${b}A${a}`
    );

    // console.log("OLD color keys", colorKeys);
    // console.log("NEW color keys", newColorKeys);

    const colorComparisonChart = {};
    for (let i = 0; i < colorKeys.length; i++) {
      colorComparisonChart[colorKeys[i]] = newColorKeys[i];
    }

    console.log("Number of colors: ", Object.keys(colorComparisonChart).length);
    console.log("Color Comparison Chart: ", colorComparisonChart);

    /**
     * --run through original pixel array
     * --for every 4 elements, create colorKey
     * --check for colorKey in colorComparisonChart
     * --if colorKey exists, take the value at that key
     *    and extract its RGBA values
     *    --place said values in new array
     * --else just add the current 4 elements to the new array
     */
    const updatedPixels = [];
    for (let i = 0; i < pixels.length; i += 4) {
      const colorKey = `R${pixels[i]}G${pixels[i + 1]}B${pixels[i + 2]}A${
        pixels[i + 3]
      }`;
      // console.log("Color Key: ", colorKey);

      const extractedValues = colorComparisonChart[colorKey]
        .match(/\d+/g)
        .map(Number);
      // console.log("Extracted values: ", extractedValues);
      updatedPixels.push(
        extractedValues[0],
        extractedValues[1],
        extractedValues[2],
        extractedValues[3]
      );
    }
    // console.log("Updated Pixels: ", updatedPixels);

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
