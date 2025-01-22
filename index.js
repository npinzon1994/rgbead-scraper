const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const sharp = require("sharp");
const multer = require("multer");

const app = express(); //this is the express app
const PORT = process.env.PORT || 5000; //in case we have an env variable
const upload = multer(); //communicates between frontend and backend

app.use(cors()); //ensures the frontend can call this API without CORS issues

app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer; //pixel array multer receives from client
    const image = sharp(imageBuffer); // image created from uploaded pixel array
    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    console.log("PIXEL ARRAY: ", data);
    return res.json({
      width: info.width,
      height: info.height,
      pixels: Array.from(data),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Failed to process image");
  }
});

app.get("/api/colors", async (req, res) => {
  //could get an error back so need try/catch
  try {
    const url =
      "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSRqGEhhyOK6pA0CWBGRU1AMPoe6AV2vDMcgw0bainqpv9-MEloTm5xR2NyaS-S3A44yXdicNksjao8/pubhtml/sheet?headers=false&gid=170380569";
    const { data } = await axios.get(url); //fetching webpage HTML from URL
    const $ = cheerio.load(data); // loading the HTML for easy DOM traversal

    /**
     * iterating over all <tr> elements from webpage
     * capturing their data
     * and storing in the colors[] array
     */
    const colors = {};

    console.log("Scraping web contents...");
    $("tr").each((_, tr) => {
      const $tr = $(tr); //wrap current <tr> in cheerio for further manipulation
      const cells = $tr.find("td.s6, td.s8");
      let currentColorName;
      const stringBuilder = []; //need for creating colorKey

      //looping over <td> elements (4 per row)
      cells.each((index, td) => {
        const cellData = $(td).text().trim();
        // console.log(`Cell ${index + 1}:`, cellData);

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
            colors[colorKey] = currentColorName;
            break;
        }
      });
    });

    res.json(colors);
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: "Failed to fetch data." });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
