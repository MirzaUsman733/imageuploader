const express = require("express");
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = 3003;

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, path.join(__dirname, 'uploads')); 
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname); 
//   }
// });
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.fieldname === "pdf" && file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    } else if (
      file.fieldname === "excel" &&
      ![
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ].includes(file.mimetype)
    ) {
      return cb(new Error("Only Excel files are allowed"));
    }
    cb(null, true);
  },
});

// Function to create directory if not exists
const createDirectoryIfNotExists = async (directoryPath) => {
  try {
    await fs.access(directoryPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(directoryPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

app.post(
  "/upload",
  upload.fields([{ name: "pdf" }, { name: "excel" }, { name: "id" }]),
  async (req, res) => {
    try {
      const id = req?.body?.id; // Extracting the ID from the request body
      if (!id) {
        return res.status(400).json({ error: "ID is required" });
      }

      // Check if PDF file is uploaded
      if (!req.files["pdf"]) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const pdfFile = req.files["pdf"][0];
      const excelFile = req.files["excel"] ? req.files["excel"][0] : null;

      // Create directory based on the first character of the filenames
      const pdfFirstChar = pdfFile.originalname[0].toUpperCase();
      const pdfDirectory = path.join(__dirname, "uploads", "pdf", pdfFirstChar);
      await createDirectoryIfNotExists(pdfDirectory);

      await fs.writeFile(
        path.join(pdfDirectory, pdfFile.originalname),
        pdfFile.buffer
      );

      if (excelFile) {
        const excelFirstChar = excelFile.originalname[0].toUpperCase();
        const excelDirectory = path.join(
          __dirname,
          "uploads",
          "excel",
          excelFirstChar
        );
        await createDirectoryIfNotExists(excelDirectory);

        await fs.writeFile(
          path.join(excelDirectory, excelFile.originalname),
          excelFile.buffer
        );
      }

      // Sending files to the remote server
      const formData = new FormData();
      formData.append("pdf", pdfFile.buffer, {
        filename: pdfFile.originalname,
      });
      if (excelFile) {
        formData.append("excel", excelFile.buffer, {
          filename: excelFile.originalname,
        });
      }
      formData.append("id", id);

      const response = await axios.post(
        "https://dashboard.imcwire.com/api/upload",
        formData
      );

      res.json(response.data);
    } catch (error) {
      console.error("Error uploading files:", error);
      res
        .status(500)
        .json({ error: "Internal server error while uploading files" });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
