const { compareFaces, detectLiveness } = require('../utils/livenessVerifier');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const axios = require('axios');

/**
 * @desc    Verify Driver Liveness (Pre-Ride Check)
 * @route   POST /api/user/verify-liveness
 * @access  Private (Driver)
 */
exports.verifyLiveness = asyncHandler(async (req, res) => {
    // In a real flow, the frontend sends a base64 or multipart/form-data selfie
    const { imageBase64 } = req.body;

    if (req.user.role !== 'RIDER') {
        return res.status(403).json({ success: false, message: 'Only riders can complete liveness verification' });
    }

    if (!imageBase64) {
        return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    try {
        // Strip out base64 prefix
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 1. Detect Liveness (Eyes open, not a photo of a photo)
        const livenessResult = await detectLiveness(imageBuffer);

        if (!livenessResult.passesLiveness) {
            return res.status(400).json({
                success: false,
                message: 'Liveness check failed. Please ensure good lighting and look directly at the camera.'
            });
        }

        // 2. Load Driver Profile to get stored License Photo
        const user = await User.findById(req.user._id).select('documents');
        const storedLicenseImage = user?.documents?.driverLicense?.frontImage;

        if (!storedLicenseImage) {
            return res.status(400).json({
                success: false,
                message: 'Upload your driver license before running liveness verification.'
            });
        }

        // Fetch the actual stored license image from Cloudinary (production-ready)
        let storedImageBuffer;
        try {
            const imgResponse = await axios.get(storedLicenseImage, { responseType: 'arraybuffer', timeout: 10000 });
            storedImageBuffer = Buffer.from(imgResponse.data);
        } catch (fetchErr) {
            console.error('Failed to fetch stored license image:', fetchErr.message);
            return res.status(502).json({
                success: false,
                message: 'Unable to retrieve stored license image for comparison.'
            });
        }

        // 3. Compare Faces
        const matchResult = await compareFaces(storedImageBuffer, imageBuffer);

        if (matchResult.isMatch) {
            // Persist liveness check timestamp
            await User.findByIdAndUpdate(req.user._id, {
                $set: { lastLivenessCheck: new Date() }
            });

            res.status(200).json({
                success: true,
                message: 'Identity verified successfully. Safe to drive.',
                similarity: matchResult.similarity
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Facial mismatch detected. Account locked pending review.'
            });
        }
    } catch (error) {
        console.error('Liveness Controller Error:', error);
        res.status(500).json({ success: false, message: 'Server Verification Error' });
    }
});
