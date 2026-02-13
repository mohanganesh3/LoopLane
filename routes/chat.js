/**
 * Chat Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');

// Get or Create Chat for a booking
router.post('/booking/:bookingId', isAuthenticated, chatController.getOrCreateChat);

// Get All User Chats
router.get('/my-chats', isAuthenticated, chatController.getUserChats);

// Get Total Unread Count
router.get('/unread-count', isAuthenticated, chatController.getTotalUnreadCount);

// Get Chat by ID with details
router.get('/:chatId/details', isAuthenticated, chatController.getChatById);

// Get Chat Messages
router.get('/:chatId/messages', isAuthenticated, chatController.getChatMessages);

// Send Message
router.post('/:chatId/messages', isAuthenticated, chatController.sendMessage);

// Mark Chat as Read
router.post('/:chatId/read', isAuthenticated, chatController.markChatAsRead);

// Delete Message
router.delete('/:chatId/messages/:messageId', isAuthenticated, chatController.deleteMessage);

module.exports = router;
