/**
 * Script to mark all old messages as read for all users
 * Run this once to clean up unread counts from old messages
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Chat = require('./models/Chat');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/looplane';

async function markAllOldMessagesAsRead() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all chats
        const chats = await Chat.find({ isActive: true });
        console.log(`📝 Found ${chats.length} active chats`);

        let totalMessagesMarked = 0;

        for (const chat of chats) {
            const participants = chat.participants;
            let messagesMarkedInChat = 0;

            // For each message, mark as read by all participants except sender
            for (const message of chat.messages) {
                if (message.deleted) continue;

                for (const participantId of participants) {
                    // Skip if sender is the participant
                    if (message.sender.toString() === participantId.toString()) continue;

                    // Check if already marked as read
                    const alreadyRead = message.readBy.some(
                        r => r.user.toString() === participantId.toString()
                    );

                    if (!alreadyRead) {
                        message.readBy.push({
                            user: participantId,
                            readAt: new Date()
                        });
                        messagesMarkedInChat++;
                    }
                }
            }

            if (messagesMarkedInChat > 0) {
                await chat.save();
                totalMessagesMarked += messagesMarkedInChat;
                console.log(`✅ Chat ${chat._id}: Marked ${messagesMarkedInChat} messages as read`);
            }
        }

        console.log(`\n🎉 Done! Marked ${totalMessagesMarked} messages as read across all chats`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

markAllOldMessagesAsRead();
