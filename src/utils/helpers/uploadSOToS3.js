// utils/helpers/uploadFileToS3.js

import { uploadToS3 } from "../s3.js";
import config from "../../config/env.js";

const uploadFileToS3 = async (file, path = "documents/path_not_provided") => {
  if (!file) {
    throw new Error("File is required");
  }

  return await uploadToS3(file, config.s3.bucketName, path);
};

export default uploadFileToS3;
