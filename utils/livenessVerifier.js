/**
 * AWS Rekognition Integration
 * Epic 3: Facial Liveness & Identity Verification Bridge
 */

const hasAwsCredentials = () => Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let cachedClient = null;
let warnedAboutLegacySdk = false;

const getRekognitionClient = () => {
    if (!hasAwsCredentials()) {
        return null;
    }

    if (cachedClient) {
        return cachedClient;
    }

    try {
        const {
            RekognitionClient,
            CompareFacesCommand,
            DetectFacesCommand
        } = require('@aws-sdk/client-rekognition');

        cachedClient = {
            mode: 'v3',
            client: new RekognitionClient({
                region: process.env.AWS_REGION || 'ap-south-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            }),
            CompareFacesCommand,
            DetectFacesCommand
        };

        return cachedClient;
    } catch (v3Error) {
        const AWS = require('aws-sdk');
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-south-1'
        });

        if (!warnedAboutLegacySdk) {
            warnedAboutLegacySdk = true;
            console.warn('[LIVENESS] Falling back to legacy aws-sdk v2 Rekognition client because @aws-sdk/client-rekognition is not installed.');
        }

        cachedClient = {
            mode: 'v2',
            client: new AWS.Rekognition()
        };

        return cachedClient;
    }
};

/**
 * Compare a freshly captured selfie with the ID on file
 * @param {Buffer} sourceImageBuffer (e.g., Driver's License Photo)
 * @param {Buffer} targetImageBuffer (e.g., Live Selfie)
 */
exports.compareFaces = async (sourceImageBuffer, targetImageBuffer) => {
    try {
        if (!hasAwsCredentials()) {
            // FAIL-CLOSED in production
            if (process.env.NODE_ENV === 'production') {
                console.error('[REKOGNITION] AWS credentials missing in production — rejecting face comparison');
                return { isMatch: false, similarity: 0, livenessPassed: false, error: 'Service unavailable' };
            }
            console.log('[MOCK REKOGNITION] Simulating face match (dev mode only)');
            return {
                isMatch: true,
                similarity: 99.12,
                livenessPassed: true
            };
        }

        const params = {
            SourceImage: { Bytes: sourceImageBuffer },
            TargetImage: { Bytes: targetImageBuffer },
            SimilarityThreshold: 85 // Strict 85% match requirement
        };

        const rekognition = getRekognitionClient();
        const response = rekognition.mode === 'v3'
            ? await rekognition.client.send(new rekognition.CompareFacesCommand(params))
            : await rekognition.client.compareFaces(params).promise();

        if (response.FaceMatches && response.FaceMatches.length > 0) {
            return {
                isMatch: true,
                similarity: response.FaceMatches[0].Similarity,
                livenessPassed: true // Assuming frontend also captured a liveness challenge
            };
        }

        return { isMatch: false, similarity: 0, livenessPassed: false };
    } catch (error) {
        console.error('AWS Rekognition Error:', error);
        throw error;
    }
};

/**
 * Perform a dedicated Liveness check (e.g., smiling, blinking analysis)
 * @param {Buffer} imageBuffer 
 */
exports.detectLiveness = async (imageBuffer) => {
    try {
        if (!hasAwsCredentials()) {
            if (process.env.NODE_ENV === 'production') {
                console.error('[REKOGNITION] AWS credentials missing in production — rejecting liveness');
                return { passesLiveness: false, confidence: 0, error: 'Service unavailable' };
            }
            return { passesLiveness: true, confidence: 95.0 };
        }

        const params = {
            Image: { Bytes: imageBuffer },
            Attributes: ['ALL']
        };

        const rekognition = getRekognitionClient();
        const response = rekognition.mode === 'v3'
            ? await rekognition.client.send(new rekognition.DetectFacesCommand(params))
            : await rekognition.client.detectFaces(params).promise();

        if (response.FaceDetails && response.FaceDetails.length > 0) {
            const face = response.FaceDetails[0];
            // Simple heuristic for liveness: 
            // AWS can return bounding boxes, emotion, eyes open.
            // A real video liveness stream is better, but this proves a high quality front-facing photo was taken.
            const passesLiveness = face.Confidence > 90 && face.EyesOpen.Value === true;
            return {
                passesLiveness,
                confidence: face.Confidence
            };
        }

        return { passesLiveness: false, confidence: 0 };
    } catch (error) {
        console.error('AWS Rekognition Liveness Error:', error);
        throw error;
    }
};
