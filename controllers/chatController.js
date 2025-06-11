import prisma from '../database/db.config.js';

// ✅ GET all conversations for current user
export const getUserConversations = async (req, res) => {
	try {
		const userId = req.user.id;

		const conversations = await prisma.conversation.findMany({
			where: {
				OR: [{ user1Id: userId }, { user2Id: userId }],
			},
			include: {
				user1: { select: { id: true, username: true, profilePic: true } },
				user2: { select: { id: true, username: true, profilePic: true } },
				messages: {
					orderBy: { createdAt: 'desc' },
					take: 1, // Get last message
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		res.json({ success: true, conversations });
	} catch (error) {
		console.error('Error fetching conversations:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// ✅ GET messages for a specific conversation
export const getMessages = async (req, res) => {
	try {
		const { conversationId } = req.params;
		const userId = req.user.id;

		const conversation = await prisma.conversation.findUnique({
			where: { id: parseInt(conversationId) },
		});

		if (
			!conversation ||
			(conversation.user1Id !== userId && conversation.user2Id !== userId)
		) {
			return res
				.status(403)
				.json({ message: 'Not authorized to view messages' });
		}

		const messages = await prisma.message.findMany({
			where: { conversationId: parseInt(conversationId) },
			orderBy: { createdAt: 'asc' },
		});

		res.json({ success: true, messages });
	} catch (error) {
		console.error('Error fetching messages:', error);
		res.status(500).json({ success: false, message: 'Internal server error' });
	}
};

// ✅ POST: send a message (create conversation if it doesn't exist)
export const sendMessage = async (req, res) => {
	try {
		const senderId = req.user.id;
		const receiverId = parseInt(req.body.receiverId, 10); // 🛠️ Ensure it's an integer
		const content = req.body.content;

		if (!receiverId || isNaN(receiverId) || !content?.trim()) {
			return res
				.status(400)
				.json({ message: 'Receiver and content are required' });
		}

		if (senderId === receiverId) {
			return res.status(400).json({ message: 'Cannot message yourself' });
		}

		let conversation = await prisma.conversation.findFirst({
			where: {
				OR: [
					{ user1Id: senderId, user2Id: receiverId },
					{ user1Id: receiverId, user2Id: senderId },
				],
			},
		});

		if (!conversation) {
			conversation = await prisma.conversation.create({
				data: {
					user1Id: senderId,
					user2Id: receiverId,
				},
			});
		} else {
			console.log('Conversation already exists, skipping creation.');
		}

		const message = await prisma.message.create({
			data: {
				conversationId: conversation.id,
				senderId,
				receiverId,
				content,
			},
		});

		res.status(201).json({ success: true, message });
	} catch (error) {
		console.error('Error sending message:', error);
		res.status(500).json({ success: false, message: 'Failed to send message' });
	}
};
