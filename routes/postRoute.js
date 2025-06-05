import express from 'express';
import {
	createPost,
	getFeedPosts,
	getPost,
	toggleLike,
	addComment,
	updateComment,
	deleteComment,
	toggleSavePost,
	getSavedPosts,
	updatePost,
	deletePost,
	getUserPosts,
} from '../controllers/postController.js';
import { isAuthenticated } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const router = express.Router();

// Post CRUD operations
router.post('/', isAuthenticated, upload.array('images', 4), createPost);
router.get('/feed', isAuthenticated, getFeedPosts);
router.get('/saved', isAuthenticated, getSavedPosts);
router.get('/user/:userId', getUserPosts); // Public route to view user posts
router.get('/:id', getPost); // Public route to view single post
router.put('/:id', isAuthenticated, updatePost);
router.delete('/:id', isAuthenticated, deletePost);

// Post interactions
router.post('/:id/like', isAuthenticated, toggleLike);
router.post('/:id/save', isAuthenticated, toggleSavePost);

// Comments
router.post('/:id/comments', isAuthenticated, addComment);
router.put('/comments/:id', isAuthenticated, updateComment);
router.delete('/comments/:id', isAuthenticated, deleteComment);

export default router;
