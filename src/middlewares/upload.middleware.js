import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});

export const tenderUpload = upload.fields([
  { name: 'tender_documents', maxCount: 20 },
  { name: 'payment_type', maxCount: 1 },
  { name: 'payment_type_file', maxCount: 1 },
  { name: 'docs_resubmitted', maxCount: 20 },
  { name: 'rank_file', maxCount: 1 },
  { name: 'counter_offer', maxCount: 1 },
  { name: 'loi', maxCount: 1 },
  { name: 'po', maxCount: 1 },
  { name: 'contract_agreement', maxCount: 1 },
  { name: 'warranty', maxCount: 1 },
  { name: 'acceptance_letter', maxCount: 1 },
  { name: 'pdf-file', maxCount: 1 },
]);
