import express from 'express';
import {
	register,
	verifyAccount,
	login,
	logout,
	forgotPassword,
	resetPassword,
	refreshAccessToken,
	checkUsernameAvailability,
} from '../controllers/userController.js';
import upload from '../middlewares/multer.js';
import { isAuthenticated } from '../middlewares/auth.js';
import {
	getUserProfile,
	updateUserProfile,
	followUser,
	getUserFollowList,
	searchUsers,
} from '../controllers/userProfileController.js';

const router = express.Router();

router.post('/register', register);
router.get('/check-username', checkUsernameAvailability);
router.get('/verify-account/:token', verifyAccount);
router.post('/login', login);
router.get('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/profile/:username', getUserProfile);
router.put(
	'/profile',
	isAuthenticated,
	upload.single('profilePic'),
	updateUserProfile
);
router.post('/:id/follow', isAuthenticated, followUser);
router.get('/:id/follow-list', getUserFollowList);
router.get('/search', searchUsers);
router.get('/refresh', refreshAccessToken);
router.get('/me', isAuthenticated, (req, res) => {
	res.status(200).json({ success: true, user: req.user });
});

export default router;
