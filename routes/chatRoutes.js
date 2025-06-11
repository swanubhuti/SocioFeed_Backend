import express from 'express';
import { isAuthenticated } from '../middlewares/auth.js';
import {
	getUserConversations,
	getMessages,
	sendMessage,
} from '../controllers/chatController.js';

const router = express.Router();

router.get('/conversations', isAuthenticated, getUserConversations);
router.get('/messages/:conversationId', isAuthenticated, getMessages);
router.post('/messages', isAuthenticated, sendMessage);

export default router;
