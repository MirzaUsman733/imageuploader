const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = 3003;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create the upload directory if it doesn't exist
    const uploadDir = path.join(__dirname, 'uploads');
    fsPromises.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((err) => cb(err));
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

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
    await fsPromises.access(directoryPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fsPromises.mkdir(directoryPath, { recursive: true });
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

      const pdfFilePath = path.join(pdfDirectory, pdfFile.originalname);
      await fsPromises.rename(pdfFile.path, pdfFilePath);

      let excelFilePath;
      if (excelFile) {
        const excelFirstChar = excelFile.originalname[0].toUpperCase();
        const excelDirectory = path.join(
          __dirname,
          "uploads",
          "excel",
          excelFirstChar
        );
        await createDirectoryIfNotExists(excelDirectory);

        excelFilePath = path.join(excelDirectory, excelFile.originalname);
        await fsPromises.rename(excelFile.path, excelFilePath);
      }

      // Sending files to the remote server
      const formData = new FormData();
      formData.append("pdf", fs.createReadStream(pdfFilePath), {
        filename: pdfFile.originalname,
      });
      if (excelFile) {
        formData.append("excel", fs.createReadStream(excelFilePath), {
          filename: excelFile.originalname,
        });
      }
      formData.append("id", id);

      const response = await axios.post(
        "https://dashboard.imcwire.com/api/upload",
        formData,
        { headers: formData.getHeaders() }
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

// Serve index.html when root path is requested
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to get specific uploaded files
app.get("/files", async (req, res) => {
  try {
    const { type, firstChar } = req.query;
    const uploadDir = path.join(__dirname, 'uploads');
    let filesList = await getFiles(uploadDir);

    if (type) {
      filesList = filesList.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return (type === 'pdf' && ext === '.pdf') || (type === 'excel' && (ext === '.xlsx' || ext === '.xls'));
      });
    }

    if (firstChar) {
      filesList = filesList.filter(file => {
        const fileName = path.basename(file);
        return fileName[0].toUpperCase() === firstChar.toUpperCase();
      });
    }

    res.json(filesList);
  } catch (error) {
    console.error("Error retrieving files:", error);
    res.status(500).json({ error: "Internal server error while retrieving files" });
  }
});

// Function to get all files in the directory
const getFiles = async (dir, files = []) => {
  const items = await fsPromises.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await getFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
