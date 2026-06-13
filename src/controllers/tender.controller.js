import tenderService from '../services/tender.service.js';
import { BadRequestError } from '../errors/customErrors.js';
import config from '../config/env.js';
import { uploadToS3 } from '../utils/s3.js';

function safeParse(val, fallback = null) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
}

class TenderController {
  // GET /api/v1/tenders
  getAll = async (req, res, next) => {
    try {

      const userId = req.user?.id;

      const tenders = await tenderService.getAllTenders(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tenders retrieved successfully',
        data: tenders,
      });
    } catch (error) {
      next(error);
    }
  };


  getActiveTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;

      const tenders = await tenderService.getActiveTenders(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Active tenders retrieved successfully',
        data: tenders,
      });

    }catch(error){
      next(error);
    }
  }


  getPendingMDApprovalTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const tenders = await tenderService.getPendingMDApprovalTenders(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Pending MD approval tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }


  getRejectedTendersForTenderAgent = async (req, res, next) => {
    try{
      const userId = req.user?.id;


      const tenders = await tenderService.getRejectedTendersForTenderAgent(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Rejected tenders retrieved successfully',
        data: tenders,
      });

    }catch(error){
      next(error);
    }
  }

  getShortfallTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;

      console.log("req.user -> ", req.user);

      const tenders = await tenderService.getShortfallTenders(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Shortfall tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }

  getCompletedTendersForTenderAgent = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const tenders = await tenderService.getCompletedTendersForTenderAgent(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Completed tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }


  getApprovedTendersForTenderAgent = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const tenders = await tenderService.getApprovedTendersForTenderAgent(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Approved tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }


  deleteTender = async (req, res, next) => {
    try{
      const { id } = req.params;

      if(!id){
        throw new BadRequestError('Tender ID is required');
      }

      await tenderService.deleteTender(id);

      return res.status(200).json({
        status: 'success',
        message: 'Tender deleted successfully',
      });


    }catch(error){
      next(error);
    }
  }

  getRepetitiveTenderDocuments = async (req, res, next) => {
    try{
      const documents = {
        "pan_card": {
          "title": "PAN Card",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/PAN_Mittalu.pdf"
        },
        "gst_dausa": {
          "title": "GST Certificate - Dausa",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/GST+RC+Dausa+MPL.pdf"
        },
        "moa": {
          "title": "Memorandum of Association",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/MOA+.pdf"
        },
        "audit_and_balance_sheet": {
          "title": "Audit & Balance Sheet",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/Audit+%26+Balance+Sheet+2024-25.pdf"
        },
        "list_of_manpower": {
          "title": "List of Manpower",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/LIST+OF+MAN+POWER+(1).pdf"
        },
        "list_of_plant_and_machinery": {
          "title": "List of Plant & Machinery",
          "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/LIST+OF+P+%26+M.pdf"
        },
        "bis": {
          "cables": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/bis/Gol_14255.pdf",
          "acsr_conductor": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/bis/Gol+398+Pt+2.pdf",
          "aaa_conductor": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/bis/Gol+398+Pt+4.pdf"
        },
        "type_test_reports": {
          "acsr_conductor": [
            {
              "file_name": "ACSR Dog Conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/acsr_conductor/ACSR+Dog+Conductor.pdf"
            },
            {
              "file_name": "ACSR Dog Type Test New",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/acsr_conductor/ACSR+Dog+Type+Test+New.pdf"
            },
            {
              "file_name": "ACSR Rabbit conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/acsr_conductor/ACSR+Rabbit+conductor.pdf"
            },
            {
              "file_name": "ACSR Weasel conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/acsr_conductor/ACSR+Weasel+conductor.pdf"
            }
          ],
          "aaa_conductor": [
            {
              "file_name": "ELMEF TTR AAAC Dog Conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/aaa_conductor/ELMEF+TTR+AAAC+Dog+Conductor.pdf"
            },
            {
              "file_name": "ELMEF TTR AAAC Rabbit Conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/aaa_conductor/ELMEF+TTR+AAAC+Rabbit+Conductor.pdf"
            },
            {
              "file_name": "ELMEF TTR AAAC Weasel Conductor",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/aaa_conductor/ELMEF+TTR+AAAC+Weasel+Conductor.pdf"
            }
          ],
          "cable": [
            {
              "file_name": "3C X 120+16+70", 
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/3C+X+120%2B16%2B70.pdf"
            },
            {
              "file_name": "3C X 150+35+95", 
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/3C+X+150%2B35%2B95.pdf"
            }, 
            {
              "file_name": "3C X 25+25",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/3C+X+25%2B25.pdf"
            }, 
            {
              "file_name": "3C X 70+16+50", 
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/3C+X+70%2B16%2B50.pdf"
            },
            {
              "file_name": "3cX 50 mm2 LT ABC", 
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/3cX+50+mm2+LT+ABC.pdf"
            },
            {
              "file_name": "ELMEF TTR 3CX35", 
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/ELMEF+TTR+3CX35.pdf"
            },
            {
              "file_name": "ELMEF TTR 3CX50+35+25sqmm Bare Massenger",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/ELMEF+TTR+3CX50%2B35%2B25sqmm+Bare+Massenger.pdf"
            },
            {
              "file_name": "ELMEF TTR IC X 35+35 Insulated Massenger",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/ELMEF+TTR+IC+X+35%2B35+Insulated+Massenger.pdf"
            },
            {
              "file_name": "IC X 25+25",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/IC+X+25%2B25.pdf"
            },
            {
              "file_name": "TTR 1Cx25+25 New",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/TTR+1Cx25%2B25+New.pdf"
            },
            {
              "file_name": "TTR 1cx25+25",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/TTR+1cx25%2B25.pdf"
            },
            {
              "file_name": "Type Test Notarized",
              "url": "https://vinayak-erp-storage.s3.ap-south-1.amazonaws.com/tenders/repetitive_docs/type_test_report/cable/Type+Test+Notarized.pdf"
            }
          ]
        }
      }

      return res.status(200).json({
        status: 'success',
        message: 'Repetitive tender documents retrieved successfully',
        data: documents,
      });
    }catch(error){
      next(error);
    }
  }

  // GET /api/v1/tenders/:id
  getById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const tender = await tenderService.getTenderById(id);

      return res.status(200).json({
        status: 'success',
        message: 'Tender retrieved successfully',
        data: tender,
      });
    } catch (error) {
      next(error);
    }
  };


  approveTender = async (req, res, next) => {
    try {
      const { id } = req.params;
      const role = req.user?.role;
      const approveStatus = req.body.approveStatus;
      if (role !== 'MD') {
        throw new BadRequestError('Only MD can approve tenders');
      }

      if(approveStatus === undefined){
        throw new BadRequestError('approveStatus field is required in request body');
      }

      const tender = await tenderService.approveTender(id, approveStatus);

      return res.status(200).json({
        status: 'success',
        message: 'Tender approved successfully',
        data: tender,
      });

    }catch(error){
      next(error);
    }
  }


  approveCounterOfferTender = async (req, res, next) => {
    try{
      const { id } = req.params;
      const role = req.user?.role;
      const approveStatus = req.body.approveStatus;
      if (role !== 'MD') {
        throw new BadRequestError('Only MD can approve counter offer tenders');
      }

      if(approveStatus === undefined){
        throw new BadRequestError('approveStatus field is required in request body');
      }

      const tender = await tenderService.approveCounterOfferTender(id, approveStatus);

      return res.status(200).json({
        status: 'success',
        message: 'Counter offer tender approved successfully',
        data: tender,
      });
    }catch(error){
      next(error);
    }
  }

  // _processRequestData = async (req) => {
  //   // 1. Convert empty string inputs to null for numeric/date fields
  //   const numericOrDateFields = [
  //     'cable_length_km', 'tender_value_cr', 'tender_fee_inr', 'emd_inr',
  //     'publish_date', 'closing_date', 'submission_expected', 'submission_actual',
  //     'submit_to_govt_portal_at', 'approved_at'
  //   ];
  //   for (const field of numericOrDateFields) {
  //     if (req.body[field] === '') {
  //       req.body[field] = null;
  //     }
  //   }

  //   // Convert shortfall to boolean if provided
  //   if (req.body.shortfall !== undefined) {
  //     req.body.shortfall = req.body.shortfall === 'true' || req.body.shortfall === true;
  //   }

  //   // 2. Upload single document fields to S3 if files are provided
  //   const singleFileFields = [
  //     'rank_file', 'counter_offer', 'loi', 'po',
  //     'contract_agreement', 'warranty', 'acceptance_letter'
  //   ];
  //   for (const field of singleFileFields) {
  //     const file = req.files?.[field]?.[0];
  //     if (file) {
  //       const s3Url = await uploadToS3(file, config.s3.bucketName, `tenders/${field}`);
  //       req.body[field] = s3Url;
  //     }
  //   }

  //   // 3. Process payment_type JSON field (handles both JSON object and S3 file upload)
  //   const paymentFile = req.files?.payment_type?.[0] || req.files?.payment_type_file?.[0];
  //   let paymentType = req.body.payment_type;
  //   if (paymentType !== undefined) {
  //     paymentType = safeParse(paymentType);
  //   }

  //   if (paymentFile) {
  //     const s3Url = await uploadToS3(paymentFile, config.s3.bucketName, 'tenders/payments');
  //     const docType = (typeof paymentType === 'object' ? paymentType?.type || paymentType?.doc_type : paymentType) || 'online_payment';
  //     paymentType = {
  //       url: s3Url,
  //       type: docType,
  //       document_url: s3Url,
  //       doc_type: docType
  //     };
  //     req.body.payment_type = paymentType;
  //   } else if (paymentType !== undefined) {
  //     // Normalize if paymentType was sent as object/string without a file
  //     if (typeof paymentType === 'string') {
  //       paymentType = {
  //         url: '',
  //         type: paymentType,
  //         document_url: '',
  //         doc_type: paymentType
  //       };
  //     } else if (paymentType && typeof paymentType === 'object') {
  //       const url = paymentType.url || paymentType.document_url || '';
  //       const type = paymentType.type || paymentType.doc_type || 'online_payment';
  //       paymentType = {
  //         url,
  //         type,
  //         document_url: url,
  //         doc_type: type
  //       };
  //     }
  //     req.body.payment_type = paymentType;
  //   }

  //   // 4. Process tender_documents (JSONB array)
  //   if (req.body.tender_documents !== undefined || req.files?.tender_documents) {
  //     let existingDocs = safeParse(req.body.tender_documents, []);
  //     if (!Array.isArray(existingDocs)) {
  //       existingDocs = existingDocs ? [existingDocs] : [];
  //     }
  //     const newDocs = [];
  //     if (req.files?.tender_documents) {
  //       for (const file of req.files.tender_documents) {
  //         const s3Url = await uploadToS3(file, config.s3.bucketName, 'tenders/documents');
  //         newDocs.push({ name: file.originalname, url: s3Url });
  //       }
  //     }
  //     req.body.tender_documents = [...existingDocs, ...newDocs];
  //   }

  //   // 5. Process docs_resubmitted (JSONB array)
  //   if (req.body.docs_resubmitted !== undefined || req.files?.docs_resubmitted) {
  //     let existingResubmitted = safeParse(req.body.docs_resubmitted, []);
  //     if (!Array.isArray(existingResubmitted)) {
  //       existingResubmitted = existingResubmitted ? [existingResubmitted] : [];
  //     }
  //     const newResubmitted = [];
  //     if (req.files?.docs_resubmitted) {
  //       for (const file of req.files.docs_resubmitted) {
  //         const s3Url = await uploadToS3(file, config.s3.bucketName, 'tenders/resubmitted');
  //         newResubmitted.push({ name: file.originalname, url: s3Url });
  //       }
  //     }
  //     req.body.docs_resubmitted = [...existingResubmitted, ...newResubmitted];
  //   }
  // };

  // POST /api/v1/tenders


  createTender = async (req, res, next) => {
    try {

      const role = req.user?.role;
      const userId = req.user?.id;

      const tender = await tenderService.createTender(req.body, role, userId);

      // console.log("tender data -> ", tender);

      return res.status(201).json({
        status: 'success',
        message: 'Tender created successfully',
        data: tender,
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/tenders/:id
  update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const role = req.user?.role;

      if (!id) {
        throw new BadRequestError('Tender ID is required');
      }

      await this._processRequestData(req);
      const tender = await tenderService.updateTender(id, req.body, role);

      return res.status(200).json({
        status: 'success',
        message: 'Tender updated successfully',
        data: tender,
      });
    } catch (error) {
      next(error);
    }
  };



  sendForApproval = async (req, res, next) => {
    try {
      const { id } = req.params;
      const role = req.user?.role;
      const userId = req.user?.id;

      if (!id) {
        throw new BadRequestError('Tender ID is required');
      }

      const tender = await tenderService.sendForApproval(id, role, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tender sent for approval successfully',
        data: tender,
      });
    } catch (error) {
      next(error);
    }
  }


  getApprovalRequestTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;

      // if(role !== 'MD'){
      //   throw new BadRequestError('Only MD can view approval request tenders');
      // }

      const tenders = await tenderService.getApprovalRequestTenders(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tenders retrieved successfully',
        data: tenders,
      });

    } catch(error){
      next(error);
    }
  }

  getCounterOfferApprovalRequestTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      // if(role !== 'MD'){
      //   throw new BadRequestError('Only MD can view counter offer approval request tenders');
      // }
      const tenders = await tenderService.getCounterOfferApprovalRequestTenders(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }

  getCounterOfferRejectedTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      // if(role !== 'MD'){
      //   throw new BadRequestError('Only MD can view counter offer rejected tenders');
      // }
      const tenders = await tenderService.getCounterOfferRejectedTenders(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Counter offer rejected tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }

  getCounterOfferApprovedTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      // if(role !== 'MD'){
      //   throw new BadRequestError('Only MD can view counter offer approved tenders');
      // }
      const tenders = await tenderService.getCounterOfferApprovedTenders(userId);
      return res.status(200).json({
        status: 'success',
        message: 'Counter offer approved tenders retrieved successfully',
        data: tenders,
      });
    }catch(error){
      next(error);
    }
  }


  getApprovedTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      if(role !== 'MD'){
        throw new BadRequestError('Only MD can view approved tenders');
      }


      const tenders = await tenderService.getApprovedTenders(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Approved tenders retrieved successfully',
        data: tenders,
      });


    }catch(error){
      next(error);
    }
  }


  getRejectedTenders = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;

      if(role !== 'MD'){
        throw new BadRequestError('Only MD can view rejected tenders');
      }

      const tenders = await tenderService.getRejectedTenders(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Rejected tenders retrieved successfully',
        data: tenders,
      });


    }catch(error){
      next(error);
    }
  }


  getTendersForAccountsTeam = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      if(role !== 'tender_handler_accounts'){
        throw new BadRequestError('Only Accounts Team can view tenders assigned to them');
      }

      const tenders = await tenderService.getTendersForAccountsTeam(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tenders for Accounts Team retrieved successfully',
        data: tenders,
      });

    }catch(error){
      next(error);
    }
  }


  getCompletedTendersForAccountsTeam = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;
      if(role !== 'tender_handler_accounts'){
        throw new BadRequestError('Only Accounts Team can view completed tenders assigned to them');
      }

      const tenders = await tenderService.getCompletedTendersForAccountsTeam(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Completed Tenders for Accounts Team retrieved successfully',
        data: tenders,
      });


    }catch(error){
      next(error);
    }
  }


  getTenderCardsCountData = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;

      if(role !== 'MD'){
        throw new BadRequestError('Only MD and Tender Agent can view tender cards count data');
      }

      const analysis = await tenderService.getTenderCardsCountData(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tender cards count data retrieved successfully',
        data: analysis,
      });

    }catch(error){
      next(error);
    }
  }


  getTendersAssignedByAccountsTeam = async (req, res, next) => {
    try{
      const userId = req.user?.id;
      const role = req.user?.role;

      // console.log("role and userId in getTendersAssignedByAccountsTeam -> ", role, userId);

      if(role !== 'tender_agent'){
        throw new BadRequestError('Only Accounts Team can view tenders assigned by them');
      }

      const tenders = await tenderService.getTendersAssignedByAccountsTeam(userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tenders assigned by Accounts Team retrieved successfully',
        data: tenders,
      });

    }catch(error){
      next(error);
    }
  }


  updateTenderByAccountsTeam = async (req, res, next) => {
    try{

      const role = req.user?.role;
      const userId = req.user?.id;

      if(role !== 'tender_handler_accounts'){
        throw new BadRequestError('Only Accounts Team can update tender details assigned to them');
      }

      const tender = await tenderService.updateTenderByAccountsTeam(req.body, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tender updated successfully by Accounts Team',
        data: tender,
      });

    }catch(error){
      next(error);
    }
  }

  markTenderCompleteByAccountsTeam = async (req, res, next) => {
    try{
      const role = req.user?.role;
      const userId = req.user?.id;

      if(role !== 'tender_handler_accounts'){
        throw new BadRequestError('Only Accounts Team can mark tender as complete assigned to them');
      }
      
      const tender = await tenderService.markTenderCompleteByAccountsTeam(req.body, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tender marked as complete successfully by Accounts Team',
        data: tender,
      });

      
    }catch(error){
      next(error);
    }
  }


  updateTenderDetails = async (req, res, next) => {
    try{
      const role = req.user?.role;
      const userId = req.user?.id;

      if(role !== 'tender_agent'){
        throw new BadRequestError('Only Tender Agent can update tender details assigned to them');
      }


      const tender = await tenderService.updateTenderDetails(req.body, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Tender details updated successfully by Tender Agent',
        data: tender,
      });

    }catch(error){
      next(error);
    }
  }



  uploadFileToS3 = async (req, res, next) => {
    try {
      const file = req.files?.['pdf-file']?.[0];
      if (!file) {
        throw new BadRequestError('File is required');
      }
      const s3Url = await uploadToS3(file, config.s3.bucketName, 'tenders/documents');
      return res.status(200).json({
        status: 'success',
        message: 'File uploaded successfully',
        data: { url: s3Url },
      });
    } catch (error) {
      next(error);
    }
  };
}




export default new TenderController();
