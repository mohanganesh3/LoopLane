/**
 * File Upload Middleware
 * Handles file uploads using Multer with Cloudinary storage
 */

const multer = require('multer');
const path = require('path');
const { storageConfigs } = require('../config/cloudinary');

// Configure multer with Cloudinary storage
const createUpload = (storage) => {
    return multer({
        storage: storage,
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        },
        fileFilter: (req, file, cb) => {
            console.log('📁 [Upload] File received:', {
                fieldname: file.fieldname,
                originalname: file.originalname,
                mimetype: file.mimetype
            });
            
            // For images, check image mimetypes
            if (file.fieldname === 'profilePhoto') {
                const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedImageTypes.includes(file.mimetype)) {
                    return cb(null, true);
                } else {
                    return cb(new Error('Invalid image type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
                }
            }
            
            // For other files, check general allowed types
            const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype);
            
            if (extname || mimetype) {
                return cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only JPEG, PNG, PDF, and DOC files are allowed.'));
            }
        }
    });
};

// Create uploads for different document types
const profileUpload = createUpload(storageConfigs.profileImages);
const documentUpload = createUpload(storageConfigs.documents);

// Multi-field upload for rider documents
const riderDocumentsUpload = multer({
    storage: storageConfigs.documents,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
        }
    }
}).fields([
    { name: 'driverLicense', maxCount: 1 },
    { name: 'aadharCard', maxCount: 1 },
    { name: 'rcBook', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'vehiclePhotos', maxCount: 5 }
]);

// Export different upload configurations
module.exports = {
    // Single file upload
    single: (fieldName) => documentUpload.single(fieldName),
    
    // Multiple files (same field)
    multiple: (fieldName, maxCount) => documentUpload.array(fieldName, maxCount),
    
    // Multiple fields
    fields: (fields) => documentUpload.fields(fields),
    
    // Profile photo upload (single file)
    profilePhoto: profileUpload.single('profilePhoto'),
    
    // Profile photo upload (fields - for compatibility with existing routes)
    profilePhotoFields: profileUpload.fields([{ name: 'profilePhoto', maxCount: 1 }]),
    
    // Document uploads for riders
    riderDocuments: riderDocumentsUpload,
    
    // Vehicle photos
    vehiclePhotos: documentUpload.array('vehiclePhotos', 5),
    
    // Error handler
    handleError: (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size too large. Maximum size is 5MB.'
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        next();
    }
};
