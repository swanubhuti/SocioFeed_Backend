import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoute.js';
import postRoutes from './routes/postRoute.js';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(
	cors({
		origin: 'http://localhost:3000',
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
		credentials: true,
	})
);

app.use('/api', userRoutes);
app.use('/api/posts', postRoutes);
app.get('/api/health', (req, res) => {
	res.status(200).json({
		success: true,
		message: 'Server is running!',
		timestamp: new Date().toISOString(),
	});
});
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: 'Route not found',
	});
});

app.listen(port, () => console.log(`Listening on port ${port}...`));
