import { uploadToS3 } from "../s3.js";
import config from "../../config/env.js";

const uploadSOPdfToS3 = async (file, path = "documents/path_not_provided") => {
  if (!file) {
    throw new Error("PDF file is required");
  }

  const year = new Date().getFullYear();

//   const path = `sales-orders/${year}/${orderNo.replace(/\//g, "_")}`;

  const url = await uploadToS3(
    file,
    config.s3.bucketName,
    path
  );

  return url;
};

export default uploadSOPdfToS3;