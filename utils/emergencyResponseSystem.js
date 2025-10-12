/**
 * Emergency Response System
 * Handles multi-tier emergency escalation, notifications, and coordination
 */

const User = require('../models/User');
const Emergency = require('../models/Emergency');
const Notification = require('../models/Notification');
const smsService = require('./smsService');
const emailService = require('./emailService');

class EmergencyResponseSystem {
    /**
     * Escalation levels and timing
     */
    static ESCALATION = {
        LEVEL_0: {
            name: 'INITIAL',
            delay: 0,
            actions: ['LOG_INCIDENT', 'START_RECORDING']
        },
        LEVEL_1: {
            name: 'EMERGENCY_CONTACTS',
            delay: 0, // Immediate
            actions: ['NOTIFY_CONTACTS', 'SHARE_LOCATION', 'START_TRACKING']
        },
        LEVEL_2: {
            name: 'ADMIN_ALERT',
            delay: 120000, // 2 minutes if no response
            actions: ['NOTIFY_ADMINS', 'ESCALATE_PRIORITY', 'CONTINUOUS_MONITORING']
        },
        LEVEL_3: {
            name: 'AUTHORITY_NOTIFICATION',
            delay: 300000, // 5 minutes if no response
            actions: ['PREPARE_POLICE_ALERT', 'GATHER_EVIDENCE', 'CONTACT_NEARBY_UNITS']
        },
        LEVEL_4: {
            name: 'EMERGENCY_DISPATCH',
            delay: 600000, // 10 minutes if no response
            actions: ['DISPATCH_AUTHORITIES', 'FULL_ALERT', 'BROADCAST_EMERGENCY']
        }
    };

    /**
     * Emergency types and their default priorities
     */
    static EMERGENCY_TYPES = {
        'SOS': { priority: 'HIGH', autoEscalate: true, requiresPolice: true },
        'ACCIDENT': { priority: 'CRITICAL', autoEscalate: true, requiresAmbulance: true, requiresPolice: true },
        'MEDICAL': { priority: 'CRITICAL', autoEscalate: true, requiresAmbulance: true },
        'THREAT': { priority: 'CRITICAL', autoEscalate: true, requiresPolice: true },
        'BREAKDOWN': { priority: 'MEDIUM', autoEscalate: false, requiresRoadside: true },
        'ROUTE_DEVIATION': { priority: 'MEDIUM', autoEscalate: true, requiresPolice: false },
        'HARASSMENT': { priority: 'HIGH', autoEscalate: true, requiresPolice: true },
        'KIDNAPPING': { priority: 'CRITICAL', autoEscalate: true, requiresPolice: true, immediateDispatch: true }
    };

    /**
     * Initialize emergency response
     * @param {Object} emergencyData - Emergency details
     * @param {Object} user - User who triggered emergency
     * @param {Object} io - Socket.io instance
     * @returns {Object} - Emergency record and response details
     */
    static async initialize(emergencyData, user, io) {
        try {
            console.log('🚨 [Emergency Response] Initializing:', emergencyData.type);

            const emergencyType = this.EMERGENCY_TYPES[emergencyData.type] || this.EMERGENCY_TYPES['SOS'];
            
            // Create emergency record
            const emergency = await Emergency.create({
                emergencyId: this.generateEmergencyId(),
                user: user._id,
                ride: emergencyData.rideId,
                booking: emergencyData.bookingId,
                type: emergencyData.type,
                location: {
                    coordinates: [emergencyData.longitude, emergencyData.latitude],
                    address: emergencyData.address,
                    accuracy: emergencyData.accuracy,
                    timestamp: new Date()
                },
                notes: emergencyData.notes,
                silentMode: emergencyData.silentMode || false,
                priority: emergencyType.priority,
                status: 'ACTIVE',
                device: {
                    userAgent: emergencyData.userAgent,
                    platform: emergencyData.platform,
                    battery: emergencyData.battery
                }
            });

            // Log initial escalation
            await emergency.escalate(0, 'Emergency triggered', 'USER');

            // Immediate actions
            const responses = {
                emergency,
                contactsNotified: [],
                adminsNotified: [],
                errors: []
            };

            // Level 1: Notify emergency contacts immediately
            responses.contactsNotified = await this.notifyEmergencyContacts(
                emergency,
                user,
                emergencyData
            );

            // Level 1: Start location tracking
            await this.startContinuousTracking(emergency, io);

            // Level 1: Start audio recording if not silent mode
            if (!emergencyData.silentMode) {
                await emergency.startAudioRecording();
            }

            // If critical, also notify admins immediately
            if (emergencyType.priority === 'CRITICAL') {
                responses.adminsNotified = await this.notifyAdmins(emergency, user, 'IMMEDIATE');
                
                // For kidnapping or immediate dispatch cases
                if (emergencyType.immediateDispatch) {
                    await this.prepareAuthorities(emergency, user, emergencyType);
                }
            }

            // Setup auto-escalation if enabled
            if (emergencyType.autoEscalate) {
                await this.setupAutoEscalation(emergency, user, io);
            }

            // Broadcast to all connected clients
            if (io) {
                io.emit('emergency:alert', {
                    emergencyId: emergency._id,
                    type: emergency.type,
                    userId: user._id,
                    userName: user.name || `${user.profile.firstName} ${user.profile.lastName}`,
                    location: emergency.location,
                    priority: emergency.priority
                });

                // Emit to admin room with new-sos-alert event
                io.to('admin-room').emit('new-sos-alert', {
                    emergencyId: emergency._id,
                    userName: user.name || `${user.profile.firstName} ${user.profile.lastName}`,
                    type: emergency.type,
                    priority: emergency.priority,
                    location: emergency.location,
                    createdAt: emergency.createdAt
                });
                
                // Also emit emergency:new for backward compatibility
                io.to('admin-room').emit('emergency:new', {
                    emergency: emergency.toJSON(),
                    user: {
                        id: user._id,
                        name: user.name || `${user.profile.firstName} ${user.profile.lastName}`,
                        phone: user.phone,
                        photo: user.profile?.photo
                    }
                });
            }

            console.log('✅ [Emergency Response] Initialized:', emergency.emergencyId);

            return responses;
        } catch (error) {
            console.error('❌ [Emergency Response] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Generate unique emergency ID
     */
    static generateEmergencyId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `EMR-${timestamp}-${random}`;
    }

    /**
     * Notify emergency contacts via SMS, Email, and In-App
     */
    static async notifyEmergencyContacts(emergency, user, emergencyData) {
        const notifications = [];

        try {
            const contacts = user.emergencyContacts || [];
            
            if (contacts.length === 0) {
                console.warn('⚠️ No emergency contacts found for user:', user._id);
                return notifications;
            }

            const locationUrl = `https://maps.google.com/?q=${emergencyData.latitude},${emergencyData.longitude}`;
            const trackingUrl = `${process.env.BASE_URL}/emergency/track/${emergency._id}`;

            for (const contact of contacts) {
                try {
                    // SMS Alert
                    if (contact.phone) {
                        const smsResult = await smsService.sendSOSAlert(contact.phone, {
                            userName: user.name,
                            contactName: contact.name,
                            emergencyType: emergency.type,
                            location: locationUrl,
                            trackingLink: trackingUrl,
                            emergencyId: emergency.emergencyId,
                            time: new Date().toLocaleTimeString('en-IN')
                        });

                        notifications.push({
                            recipient: contact.phone,
                            recipientName: contact.name,
                            type: 'SMS',
                            status: smsResult.success ? 'SENT' : 'FAILED',
                            sentAt: new Date()
                        });
                    }

                    // Email Alert
                    if (contact.email) {
                        const emailResult = await emailService.sendEmergencyAlert({
                            to: contact.email,
                            contactName: contact.name,
                            userName: user.name,
                            userPhone: user.phone,
                            emergencyType: emergency.type,
                            location: {
                                lat: emergencyData.latitude,
                                lng: emergencyData.longitude,
                                address: emergencyData.address,
                                mapUrl: locationUrl
                            },
                            trackingUrl,
                            emergencyId: emergency.emergencyId,
                            notes: emergency.notes,
                            timestamp: new Date()
                        });

                        notifications.push({
                            recipient: contact.email,
                            recipientName: contact.name,
                            type: 'EMAIL',
                            status: emailResult.success ? 'SENT' : 'FAILED',
                            sentAt: new Date()
                        });
                    }
                } catch (error) {
                    console.error(`Failed to notify contact ${contact.name}:`, error);
                    notifications.push({
                        recipient: contact.phone || contact.email,
                        recipientName: contact.name,
                        type: 'FAILED',
                        status: 'FAILED',
                        error: error.message
                    });
                }
            }

            // Save notification log to emergency record
            emergency.notificationsSent = notifications;
            await emergency.save();

            console.log(`✅ Notified ${notifications.filter(n => n.status === 'SENT').length}/${contacts.length} emergency contacts`);

            return notifications;
        } catch (error) {
            console.error('Error notifying emergency contacts:', error);
            return notifications;
        }
    }

    /**
     * Notify admins
     */
    static async notifyAdmins(emergency, user, urgency = 'NORMAL') {
        const notifications = [];

        try {
            const admins = await User.find({ role: 'ADMIN', isActive: true });

            for (const admin of admins) {
                // Create in-app notification
                await Notification.create({
                    user: admin._id,
                    type: 'SOS_ALERT',
                    title: `🚨 ${urgency === 'IMMEDIATE' ? 'CRITICAL ' : ''}Emergency Alert`,
                    message: `${user.name} triggered ${emergency.type} emergency`,
                    priority: urgency === 'IMMEDIATE' ? 'CRITICAL' : 'HIGH',
                    data: {
                        emergencyId: emergency._id,
                        userId: user._id,
                        location: emergency.location,
                        type: emergency.type
                    }
                });

                // Send SMS to admin if urgent
                if (urgency === 'IMMEDIATE' && admin.phone) {
                    await smsService.send(admin.phone, 
                        `🚨 CRITICAL EMERGENCY\n` +
                        `User: ${user.name}\n` +
                        `Type: ${emergency.type}\n` +
                        `ID: ${emergency.emergencyId}\n` +
                        `Action required immediately!`
                    );
                }

                notifications.push({
                    adminId: admin._id,
                    adminName: admin.name,
                    notified: true
                });
            }

            return notifications;
        } catch (error) {
            console.error('Error notifying admins:', error);
            return notifications;
        }
    }

    /**
     * Start continuous location tracking
     */
    static async startContinuousTracking(emergency, io) {
        if (io) {
            // Create a tracking room for this emergency
            const trackingRoom = `emergency-${emergency._id}`;
            
            // Emit tracking started event
            io.emit('emergency:tracking-started', {
                emergencyId: emergency._id,
                trackingRoom
            });

            console.log(`📍 Started continuous tracking for emergency: ${emergency.emergencyId}`);
        }
    }

    /**
     * Setup automatic escalation
     */
    static async setupAutoEscalation(emergency, user, io) {
        try {
            // Level 2: Escalate to admins after 2 minutes if not resolved
            setTimeout(async () => {
                const currentEmergency = await Emergency.findById(emergency._id);
                
                if (currentEmergency && currentEmergency.status === 'ACTIVE') {
                    console.log(`⬆️ Auto-escalating to Level 2: ${emergency.emergencyId}`);
                    
                    await currentEmergency.escalate(2, 'Auto-escalation: No response', 'AUTO');
                    await this.notifyAdmins(currentEmergency, user, 'ESCALATED');
                    
                    if (io) {
                        io.emit('emergency:escalated', {
                            emergencyId: emergency._id,
                            level: 2
                        });
                    }
                }
            }, this.ESCALATION.LEVEL_2.delay);

            // Level 3: Prepare authorities after 5 minutes
            setTimeout(async () => {
                const currentEmergency = await Emergency.findById(emergency._id);
                
                if (currentEmergency && currentEmergency.status === 'ACTIVE') {
                    console.log(`⬆️ Auto-escalating to Level 3: ${emergency.emergencyId}`);
                    
                    await currentEmergency.escalate(3, 'Auto-escalation: Extended duration', 'AUTO');
                    
                    const emergencyType = this.EMERGENCY_TYPES[currentEmergency.type];
                    if (emergencyType.requiresPolice || emergencyType.requiresAmbulance) {
                        await this.prepareAuthorities(currentEmergency, user, emergencyType);
                    }
                }
            }, this.ESCALATION.LEVEL_3.delay);

            // Level 4: Consider dispatch after 10 minutes
            setTimeout(async () => {
                const currentEmergency = await Emergency.findById(emergency._id);
                
                if (currentEmergency && currentEmergency.status === 'ACTIVE') {
                    console.log(`🚨 Level 4 reached: ${emergency.emergencyId} - Manual intervention required`);
                    
                    await currentEmergency.escalate(4, 'Critical: Manual dispatch consideration', 'AUTO');
                    
                    // Notify admins that dispatch may be needed
                    await this.notifyAdmins(currentEmergency, user, 'IMMEDIATE');
                    
                    if (io) {
                        io.to('admin-room').emit('emergency:dispatch-consideration', {
                            emergencyId: emergency._id,
                            message: 'Emergency requires dispatch consideration'
                        });
                    }
                }
            }, this.ESCALATION.LEVEL_4.delay);

        } catch (error) {
            console.error('Error setting up auto-escalation:', error);
        }
    }

    /**
     * Prepare authorities notification
     */
    static async prepareAuthorities(emergency, user, emergencyType) {
        try {
            console.log('👮 Preparing authorities notification:', emergency.emergencyId);

            // In production, this would integrate with police/ambulance dispatch systems
            const authoritiesData = {
                caseNumber: `CASE-${emergency.emergencyId}`,
                incidentType: emergency.type,
                location: {
                    lat: emergency.location.coordinates[1],
                    lng: emergency.location.coordinates[0],
                    address: emergency.location.address
                },
                victim: {
                    name: user.name,
                    phone: user.phone,
                    age: user.profile?.age
                },
                emergencyContacts: user.emergencyContacts,
                priority: emergency.priority,
                timestamp: new Date(),
                requiresPolice: emergencyType.requiresPolice,
                requiresAmbulance: emergencyType.requiresAmbulance
            };

            // Update emergency record
            emergency.emergencyServices = {
                dispatched: false, // Would be true when actually dispatched
                serviceType: emergencyType.requiresAmbulance ? 'AMBULANCE' : 'POLICE',
                dispatchTime: null,
                caseNumber: authoritiesData.caseNumber,
                notes: 'Authorities prepared, awaiting dispatch confirmation'
            };

            await emergency.save();

            // Log for admin review
            console.log('📋 Authorities data prepared:', authoritiesData.caseNumber);

            return authoritiesData;
        } catch (error) {
            console.error('Error preparing authorities:', error);
            throw error;
        }
    }

    /**
     * Update emergency location in real-time
     */
    static async updateLocation(emergencyId, locationData, io) {
        try {
            const emergency = await Emergency.findById(emergencyId);
            
            if (!emergency) {
                throw new Error('Emergency not found');
            }

            await emergency.addLocationUpdate({
                coordinates: [locationData.longitude, locationData.latitude],
                timestamp: new Date(),
                speed: locationData.speed,
                accuracy: locationData.accuracy
            });

            // Broadcast location update to emergency room
            if (io) {
                io.to(`emergency-${emergencyId}`).emit('emergency:location-update', {
                    emergencyId,
                    location: {
                        lat: locationData.latitude,
                        lng: locationData.longitude,
                        speed: locationData.speed,
                        accuracy: locationData.accuracy,
                        timestamp: new Date()
                    }
                });
                
                // Also emit to admin room with sos-location-update event
                io.to('admin-room').emit('sos-location-update', {
                    emergencyId,
                    location: {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        speed: locationData.speed,
                        accuracy: locationData.accuracy,
                        timestamp: new Date()
                    }
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating emergency location:', error);
            throw error;
        }
    }

    /**
     * Resolve emergency
     */
    static async resolve(emergencyId, resolution, resolvedBy, io) {
        try {
            const emergency = await Emergency.findById(emergencyId);
            
            if (!emergency) {
                throw new Error('Emergency not found');
            }

            emergency.status = 'RESOLVED';
            emergency.resolvedAt = new Date();
            emergency.resolvedBy = resolvedBy;
            emergency.resolution = resolution;
            
            await emergency.save();

            // Notify all parties
            if (io) {
                io.emit('emergency:resolved', {
                    emergencyId,
                    resolution,
                    resolvedAt: new Date()
                });
            }

            // Calculate false alarm score
            const duration = (emergency.resolvedAt - emergency.createdAt) / 1000; // seconds
            if (duration < 60) {
                emergency.falseAlarmIndicators.quickResolution = true;
                emergency.falseAlarmIndicators.score += 30;
            }

            await emergency.save();

            console.log(`✅ Emergency resolved: ${emergency.emergencyId}`);

            return { success: true, emergency };
        } catch (error) {
            console.error('Error resolving emergency:', error);
            throw error;
        }
    }

    /**
     * Mark as false alarm
     */
    static async markFalseAlarm(emergencyId, reason, markedBy) {
        try {
            const emergency = await Emergency.findById(emergencyId);
            
            if (!emergency) {
                throw new Error('Emergency not found');
            }

            emergency.status = 'FALSE_ALARM';
            emergency.resolvedAt = new Date();
            emergency.resolution = `False alarm: ${reason}`;
            emergency.falseAlarmIndicators.userReported = true;
            emergency.falseAlarmIndicators.score = 100;
            emergency.falseAlarmIndicators.flagged = true;
            
            await emergency.save();

            console.log(`⚠️ Emergency marked as false alarm: ${emergency.emergencyId}`);

            return { success: true };
        } catch (error) {
            console.error('Error marking false alarm:', error);
            throw error;
        }
    }

    /**
     * Get emergency statistics
     */
    static async getStatistics(timeframe = 'month') {
        try {
            const dateFilter = this.getDateFilter(timeframe);
            
            const stats = {
                total: await Emergency.countDocuments(dateFilter),
                active: await Emergency.countDocuments({ ...dateFilter, status: 'ACTIVE' }),
                resolved: await Emergency.countDocuments({ ...dateFilter, status: 'RESOLVED' }),
                falseAlarms: await Emergency.countDocuments({ ...dateFilter, status: 'FALSE_ALARM' }),
                byType: {},
                byPriority: {},
                averageResponseTime: 0,
                escalationRate: 0
            };

            // Group by type
            const byType = await Emergency.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]);

            byType.forEach(item => {
                stats.byType[item._id] = item.count;
            });

            // Group by priority
            const byPriority = await Emergency.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]);

            byPriority.forEach(item => {
                stats.byPriority[item._id] = item.count;
            });

            // Calculate average response time
            const resolved = await Emergency.find({
                ...dateFilter,
                status: 'RESOLVED',
                resolvedAt: { $exists: true }
            });

            if (resolved.length > 0) {
                const totalTime = resolved.reduce((sum, em) => {
                    return sum + (em.resolvedAt - em.createdAt);
                }, 0);
                stats.averageResponseTime = Math.round(totalTime / resolved.length / 1000 / 60); // minutes
            }

            // Calculate escalation rate
            const escalated = await Emergency.countDocuments({
                ...dateFilter,
                escalationLevel: { $gte: 2 }
            });
            stats.escalationRate = stats.total > 0 ? Math.round((escalated / stats.total) * 100) : 0;

            return stats;
        } catch (error) {
            console.error('Error getting emergency statistics:', error);
            throw error;
        }
    }

    /**
     * Get date filter for timeframe
     */
    static getDateFilter(timeframe) {
        const now = new Date();
        let startDate;

        switch (timeframe) {
            case 'day':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
            default:
                startDate = new Date(now.setMonth(now.getMonth() - 1));
        }

        return { createdAt: { $gte: startDate } };
    }
}

module.exports = EmergencyResponseSystem;
