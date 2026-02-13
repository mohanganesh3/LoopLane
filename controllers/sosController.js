/**
 * SOS Controller (Rebuilt October 2025)
 * Handles emergency SOS alerts with new Emergency schema
 */

const Emergency = require('../models/Emergency');
const User = require('../models/User');
const emailService = require('../utils/emailService');

/**
 * Show SOS Emergency Page
 */
exports.showEmergencyPage = async (req, res) => {
    try {
        res.render('sos/emergency', {
            title: 'Emergency SOS - LANE',
            user: req.user
        });
    } catch (error) {
        console.error('[SOS] Error showing emergency page:', error);
        if (req.flash) req.flash('error', 'Unable to load emergency page');
        res.redirect('/');
    }
};

/**
 * Trigger Emergency Alert
 */
exports.triggerEmergency = async (req, res) => {
    console.log('🚨 [SOS] ===== EMERGENCY TRIGGER START =====');
    console.log('🚨 [SOS] User:', req.user?._id);
    console.log('🚨 [SOS] Body:', JSON.stringify(req.body, null, 2));
    
    try {
        const { location, type, description, deviceInfo } = req.body;
        
        // Validate location
        if (!location || !location.latitude || !location.longitude) {
            console.error('🚨 [SOS] ❌ Invalid location');
            return res.status(400).json({
                success: false,
                message: 'Location is required to trigger emergency'
            });
        }
        
        console.log('🚨 [SOS] ✅ Location valid:', location);
        
        // Check for existing open emergency using new model method
        const existingEmergency = await Emergency.getOpenEmergencyForUser(req.user._id);
        
        if (existingEmergency) {
            console.warn('🚨 [SOS] ⚠️ User has open emergency:', existingEmergency._id);
            return res.status(400).json({
                success: false,
                message: 'You already have an active emergency alert',
                emergency: existingEmergency
            });
        }
        
        console.log('🚨 [SOS] ✅ No existing emergency');
        
        // Get user with emergency contacts
        const user = await User.findById(req.user._id).select('emergencyContacts profile email phone');
        
        if (!user) {
            console.error('🚨 [SOS] ❌ User not found');
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        console.log('🚨 [SOS] ✅ User loaded:', {
            email: user.email,
            contactsCount: user.emergencyContacts?.length || 0
        });
        
        // Build contacts array from user's emergency contacts
        const contacts = [];
        const guardianEmails = [];
        
        if (user.emergencyContacts && user.emergencyContacts.length > 0) {
            for (const contact of user.emergencyContacts) {
                contacts.push({
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone || '',
                    notifiedAt: new Date()
                });
                if (contact.email) {
                    guardianEmails.push(contact.email);
                }
            }
            console.log('🚨 [SOS] Guardian emails:', guardianEmails);
        } else {
            console.warn('🚨 [SOS] ⚠️ No emergency contacts');
        }
        
        // Create emergency with NEW schema
        console.log('🚨 [SOS] Creating emergency document...');
        const emergency = new Emergency({
            user: req.user._id,
            type: type || 'SOS',
            severity: 'HIGH',
            status: 'ACTIVE',
            description: description || 'Emergency SOS triggered by user',
            location: {
                coordinates: {
                    type: 'Point',
                    coordinates: [location.longitude, location.latitude]
                },
                address: location.address || (location.latitude + ', ' + location.longitude),
                accuracy: location.accuracy
            },
            deviceInfo: {
                userAgent: deviceInfo?.userAgent || req.headers['user-agent'],
                platform: deviceInfo?.platform,
                language: deviceInfo?.language
            },
            contacts: contacts,
            notifications: [],
            triggeredAt: new Date()
        });
        
        await emergency.save();
        console.log('🚨 [SOS] ✅ Emergency saved:', emergency._id);
        
        // Send emails to guardians
        if (guardianEmails.length > 0) {
            try {
                console.log('🚨 [SOS] Sending emails...');
                const userName = ((user.profile?.firstName || '') + ' ' + (user.profile?.lastName || '')).trim() || 'User';
                const locationUrl = 'https://www.google.com/maps?q=' + location.latitude + ',' + location.longitude;
                
                await emailService.sendEmergencyAlert(guardianEmails, {
                    userName,
                    userEmail: user.email,
                    userPhone: user.phone || 'Not provided',
                    location: location.address || (location.latitude + ', ' + location.longitude),
                    locationUrl,
                    time: new Date().toLocaleString(),
                    emergencyId: emergency._id,
                    type: type || 'SOS'
                });
                
                console.log('🚨 [SOS] ✅ Emails sent');
                
                // Track email notifications in new schema
                guardianEmails.forEach(email => {
                    emergency.notifications.push({
                        channel: 'EMAIL',
                        target: email,
                        deliveredAt: new Date(),
                        metadata: new Map([['status', 'sent']])
                    });
                });
                
                await emergency.save();
                console.log('🚨 [SOS] ✅ Notifications tracked');
                
            } catch (emailError) {
                console.error('🚨 [SOS] ❌ Email error:', emailError.message);
                console.error('🚨 [SOS] Stack:', emailError.stack);
                // Don't fail - continue to notify admin
            }
        }
        
        // Notify admin via Socket.IO
        if (req.app.get('io')) {
            try {
                const populatedEmergency = await Emergency.findById(emergency._id)
                    .populate('user', 'profile email phone emergencyContacts')
                    .lean();
                
                req.app.get('io').to('admin-room').emit('emergency:new', {
                    emergency: populatedEmergency,
                    message: 'New ' + emergency.type + ' alert from ' + (user.profile?.firstName || 'User')
                });
                
                console.log('🚨 [SOS] ✅ Socket.IO notification sent');
            } catch (socketError) {
                console.error('🚨 [SOS] ⚠️ Socket error (non-critical):', socketError.message);
            }
        } else {
            console.warn('🚨 [SOS] ⚠️ Socket.IO not available');
        }
        
        // Success response
        const response = {
            success: true,
            message: 'Emergency alert sent successfully',
            emergency: {
                _id: emergency._id,
                type: emergency.type,
                status: emergency.status,
                severity: emergency.severity,
                triggeredAt: emergency.triggeredAt,
                location: emergency.location,
                contactsNotified: contacts.length
            }
        };
        
        console.log('🚨 [SOS] ✅ Sending response:', JSON.stringify(response, null, 2));
        res.status(200).json(response);
        
        console.log('🚨 [SOS] ===== EMERGENCY TRIGGER COMPLETE =====');
        
    } catch (error) {
        console.error('🚨 [SOS] ❌❌❌ CRITICAL ERROR ❌❌❌');
        console.error('🚨 [SOS] Error:', error);
        console.error('🚨 [SOS] Message:', error.message);
        console.error('🚨 [SOS] Stack:', error.stack);
        console.error('🚨 [SOS] ========================================');
        
        res.status(500).json({
            success: false,
            message: 'Failed to trigger emergency alert',
            error: error.message
        });
    }
};

/**
 * Get Active Emergency Status
 */
exports.getEmergencyStatus = async (req, res) => {
    try {
        const emergency = await Emergency.getOpenEmergencyForUser(req.user._id);
        
        res.json({
            success: true,
            emergency: emergency || null
        });
    } catch (error) {
        console.error('[SOS] Error getting emergency status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emergency status'
        });
    }
};

/**
 * Cancel Emergency
 */
exports.cancelEmergency = async (req, res) => {
    try {
        const emergency = await Emergency.findOne({
            _id: req.params.emergencyId,
            user: req.user._id
        });
        
        if (!emergency) {
            return res.status(404).json({
                success: false,
                message: 'Emergency not found'
            });
        }
        
        if (emergency.status === 'RESOLVED' || emergency.status === 'CANCELLED') {
            return res.status(400).json({
                success: false,
                message: 'Emergency is already resolved'
            });
        }
        
        await emergency.markCancelled(req.user._id, 'Cancelled by user');
        
        if (req.app.get('io')) {
            req.app.get('io').to('admin-room').emit('emergency:cancelled', {
                emergencyId: emergency._id,
                message: 'Emergency cancelled by user'
            });
        }
        
        res.json({
            success: true,
            message: 'Emergency cancelled successfully'
        });
        
    } catch (error) {
        console.error('[SOS] Error cancelling emergency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel emergency'
        });
    }
};

/**
 * Admin: Get All Emergencies
 */
exports.getAllEmergencies = async (req, res) => {
    try {
        const { status, severity, type, startDate, endDate } = req.query;
        
        let query = {};
        
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (type) query.type = type;
        
        if (startDate || endDate) {
            query.triggeredAt = {};
            if (startDate) query.triggeredAt.$gte = new Date(startDate);
            if (endDate) query.triggeredAt.$lte = new Date(endDate);
        }
        
        const emergencies = await Emergency.find(query)
            .populate('user', 'profile email phone emergencyContacts')
            .populate('responder', 'profile email')
            .sort({ triggeredAt: -1 })
            .limit(100)
            .lean();
        
        console.log('[Admin SOS] Found ' + emergencies.length + ' emergencies');
        
        res.json({
            success: true,
            emergencies: emergencies,
            count: emergencies.length
        });
        
    } catch (error) {
        console.error('[Admin SOS] Error getting emergencies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emergencies'
        });
    }
};

/**
 * Admin: Get Active Emergencies
 */
exports.getActiveEmergencies = async (req, res) => {
    try {
        const emergencies = await Emergency.find({
            status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] }
        })
        .populate('user', 'profile email phone emergencyContacts')
        .populate('responder', 'profile email')
        .sort({ triggeredAt: -1 })
        .lean();
        
        res.json({
            success: true,
            emergencies: emergencies,
            count: emergencies.length
        });
        
    } catch (error) {
        console.error('[Admin SOS] Error getting active emergencies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get active emergencies'
        });
    }
};

/**
 * Admin: Update Emergency Status
 */
exports.updateEmergencyStatus = async (req, res) => {
    try {
        const { emergencyId } = req.params;
        const { status, adminNotes } = req.body;
        
        const emergency = await Emergency.findById(emergencyId);
        
        if (!emergency) {
            return res.status(404).json({
                success: false,
                message: 'Emergency not found'
            });
        }
        
        const oldStatus = emergency.status;
        
        if (status === 'ACKNOWLEDGED') {
            await emergency.markAcknowledged(req.user._id, adminNotes);
        } else if (status === 'RESOLVED') {
            await emergency.markResolved(req.user._id, adminNotes);
        } else if (status === 'CANCELLED') {
            await emergency.markCancelled(req.user._id, adminNotes);
        } else {
            emergency.status = status;
            emergency.responder = req.user._id;
            if (adminNotes) emergency.adminNotes = adminNotes;
            await emergency.save();
        }
        
        if (req.app.get('io')) {
            req.app.get('io').to('admin-room').emit('emergency:updated', {
                emergencyId: emergency._id,
                oldStatus,
                newStatus: status,
                responder: req.user.email
            });
        }
        
        res.json({
            success: true,
            message: 'Emergency status updated successfully',
            emergency: emergency
        });
        
    } catch (error) {
        console.error('[Admin SOS] Error updating emergency:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update emergency status',
            error: error.message
        });
    }
};

/**
 * Admin: Get Emergency Stats
 */
exports.getEmergencyStats = async (req, res) => {
    try {
        const { period } = req.query;
        
        let start, end;
        const now = new Date();
        
        switch(period) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'week':
                start = new Date(now.setDate(now.getDate() - 7));
                end = new Date();
                break;
            case 'month':
                start = new Date(now.setMonth(now.getMonth() - 1));
                end = new Date();
                break;
            default:
                start = undefined;
                end = undefined;
        }
        
        const stats = await Emergency.getStats({ start, end });
        
        res.json({
            success: true,
            stats: stats,
            period: period || 'all'
        });
        
    } catch (error) {
        console.error('[Admin SOS] Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emergency statistics'
        });
    }
};

/**
 * Admin: Get Emergency Details
 */
exports.getEmergencyDetails = async (req, res) => {
    try {
        const { emergencyId } = req.params;
        
        const emergency = await Emergency.findById(emergencyId)
            .populate('user', 'profile email phone emergencyContacts')
            .populate('responder', 'profile email')
            .lean();
        
        if (!emergency) {
            return res.status(404).json({
                success: false,
                message: 'Emergency not found'
            });
        }
        
        res.json({
            success: true,
            emergency: emergency
        });
        
    } catch (error) {
        console.error('[Admin SOS] Error getting emergency details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get emergency details'
        });
    }
};
