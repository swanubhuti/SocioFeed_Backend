import { Server } from 'socket.io';

export const initSocket = (server) => {
	const io = new Server(server, {
		cors: {
			origin: 'http://localhost:3000',
			credentials: true,
		},
	});

	const userSocketMap = new Map();

	io.on('connection', (socket) => {
		const userId = socket.handshake.auth?.userId;

		if (userId) {
			userSocketMap.set(userId, socket.id);
			console.log(`🔌 User connected: ${userId}`);
		}

		socket.on('sendMessage', ({ conversationId, receiverId, content }) => {
			const senderId = socket.handshake.auth.userId;

			if (!senderId) return console.error('Missing sender ID in WebSocket');

			const receiverSocketId = userSocketMap.get(receiverId);
			const senderSocketId = userSocketMap.get(senderId); // 🔥 Fix: Get sender socket ID

			const newMessage = {
				conversationId,
				senderId,
				receiverId,
				content,
				createdAt: new Date(),
			};

			if (receiverSocketId) {
				io.to(receiverSocketId).emit('receiveMessage', newMessage); // ✅ Receiver sees message instantly
			}

			if (senderSocketId) {
				io.to(senderSocketId).emit('receiveMessage', newMessage); // ✅ Sender sees their own message instantly
			}
		});
		socket.on('disconnect', () => {
			if (userId) {
				userSocketMap.delete(userId);
				console.log(`❌ User disconnected: ${userId}`);
			}
		});
	});

	console.log('🚀 Socket.IO initialized');
};
