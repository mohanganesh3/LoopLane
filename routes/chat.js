/**
 * Chat Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');
const { chatLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { featureGate } = require('../middleware/settingsEnforcer');

// Apply apiLimiter as baseline for all chat routes
router.use(apiLimiter);
// Gate all chat routes by chatEnabled feature toggle
router.use(featureGate('chatEnabled'));

/**
 * @swagger
 * /api/chat/booking/{bookingId}:
 *   post:
 *     tags: ['💬 Chat']
 *     summary: Get or create chat for a booking
 *     description: |
 *       Returns an existing chat thread for the booking, or creates one if it doesn't exist.
 *       Both the passenger and rider of the booking can access the chat.
 *       Requires `chatEnabled` platform setting to be ON.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chat retrieved or created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 chat:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     booking: { type: string }
 *                     participants: { type: array, items: { type: string } }
 *                     createdAt: { type: string, format: date-time }
 *       403:
 *         description: Not a participant of this booking
 *       503:
 *         description: Chat feature is disabled by admin
 */
router.post('/booking/:bookingId', isAuthenticated, chatController.getOrCreateChat);

/**
 * @swagger
 * /api/chat/my-chats:
 *   get:
 *     tags: ['💬 Chat']
 *     summary: List all user's chats
 *     description: Returns all chat threads where the authenticated user is a participant, sorted by most recent message.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User's chat list
 */
router.get('/my-chats', isAuthenticated, chatController.getUserChats);

/**
 * @swagger
 * /api/chat/unread-count:
 *   get:
 *     tags: ['💬 Chat']
 *     summary: Get total unread message count
 *     description: Returns the total number of unread messages across all of the user's chats. Used for badge counts.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 unreadCount: { type: integer, example: 5 }
 */
router.get('/unread-count', isAuthenticated, chatController.getTotalUnreadCount);

/**
 * @swagger
 * /api/chat/by-ride/{rideId}:
 *   get:
 *     tags: ['💬 Chat']
 *     summary: Get chats by ride ID
 *     description: Returns all chat threads associated with a specific ride (one per booking).
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chats for the ride
 */
router.get('/by-ride/:rideId', isAuthenticated, chatController.getChatsByRide);

/**
 * @swagger
 * /api/chat/{chatId}/details:
 *   get:
 *     tags: ['💬 Chat']
 *     summary: Get chat by ID with full details
 *     description: Returns a chat thread with participant profiles and the related booking/ride info.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chat details
 *       403:
 *         description: Not a participant of this chat
 */
router.get('/:chatId/details', isAuthenticated, chatController.getChatById);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   get:
 *     tags: ['💬 Chat']
 *     summary: Get chat messages (paginated)
 *     description: Returns paginated messages for a chat thread, newest first.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Messages list
 */
router.get('/:chatId/messages', isAuthenticated, chatController.getChatMessages);

/**
 * @swagger
 * /api/chat/{chatId}/messages:
 *   post:
 *     tags: ['💬 Chat']
 *     summary: Send a message
 *     description: Sends a message to a chat thread. Rate limited to prevent spam (30 messages/minute).
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *     responses:
 *       201:
 *         description: Message sent
 *       403:
 *         description: Not a participant of this chat
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/:chatId/messages', isAuthenticated, chatLimiter, chatController.sendMessage);

/**
 * @swagger
 * /api/chat/{chatId}/read:
 *   post:
 *     tags: ['💬 Chat']
 *     summary: Mark chat as read
 *     description: Marks all unread messages in a chat as read for the current user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chat marked as read
 */
router.post('/:chatId/read', isAuthenticated, chatController.markChatAsRead);

/**
 * @swagger
 * /api/chat/{chatId}/messages/{messageId}:
 *   delete:
 *     tags: ['💬 Chat']
 *     summary: Delete a message
 *     description: Soft-deletes a message. Users can only delete their own messages.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Message deleted
 *       403:
 *         description: Not the message owner
 */
router.delete('/:chatId/messages/:messageId', isAuthenticated, chatController.deleteMessage);

module.exports = router;
