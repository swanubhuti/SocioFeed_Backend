import express from 'express';
import {
	register,
	verifyAccount,
	login,
	logout,
	forgotPassword,
	resetPassword,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/register', register);
router.get('/verify-account/:token', verifyAccount);
router.post('/login', login);
router.get('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

export default router;
