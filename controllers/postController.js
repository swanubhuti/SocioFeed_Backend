import prisma from '../database/db.config.js';
import { catchAsyncError } from '../middlewares/catchAsyncError.js';
import ErrorHandler from '../middlewares/error.js';
import {
	uploadToCloudinary,
	deleteFromCloudinary,
} from '../utils/cloudinary.js';
import fs from 'fs';

// POST /api/posts - Create a new post
export const createPost = catchAsyncError(async (req, res, next) => {
	const { content } = req.body;
	const userId = req.user.id;

	if (!content && (!req.files || req.files.length === 0)) {
		return next(new ErrorHandler('Post must have content or images', 400));
	}

	let imageUrls = [];

	// Handle multiple image uploads
	if (req.files && req.files.length > 0) {
		if (req.files.length > 4) {
			return next(new ErrorHandler('Maximum 4 images allowed per post', 400));
		}

		try {
			const uploadPromises = req.files.map(async (file) => {
				const result = await uploadToCloudinary(file.path, 'posts');
				fs.unlinkSync(file.path); // Clean up temp file
				return result.secure_url;
			});

			imageUrls = await Promise.all(uploadPromises);
		} catch (error) {
			// Clean up temp files on error
			req.files.forEach((file) => {
				if (fs.existsSync(file.path)) {
					fs.unlinkSync(file.path);
				}
			});
			return next(new ErrorHandler('Failed to upload images', error, 500));
		}
	}

	const post = await prisma.post.create({
		data: {
			content: content || null,
			images: imageUrls,
			authorId: userId,
		},
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
			_count: {
				select: {
					likes: true,
					comments: true,
				},
			},
		},
	});

	res.status(201).json({
		success: true,
		message: 'Post created successfully',
		post,
	});
});

// GET /api/posts/feed - Get timeline/feed posts
export const getFeedPosts = catchAsyncError(async (req, res, next) => {
	const userId = req.user.id;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	const skip = (page - 1) * limit;

	// Get user's following list
	const following = await prisma.follow.findMany({
		where: { followerId: userId },
		select: { followingId: true },
	});

	const followingIds = following.map((f) => f.followingId);
	followingIds.push(userId); // Include user's own posts

	const posts = await prisma.post.findMany({
		where: {
			authorId: { in: followingIds },
		},
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
			_count: {
				select: {
					likes: true,
					comments: true,
				},
			},
			likes: {
				where: { userId },
				select: { id: true },
			},
			savedPosts: {
				where: { userId },
				select: { id: true },
			},
		},
		orderBy: { createdAt: 'desc' },
		skip,
		take: limit,
	});

	// Transform posts to include user interaction status
	const transformedPosts = posts.map((post) => ({
		...post,
		isLiked: post.likes.length > 0,
		isSaved: post.savedPosts.length > 0,
		likesCount: post._count.likes,
		commentsCount: post._count.comments,
		likes: undefined,
		savedPosts: undefined,
		_count: undefined,
	}));

	const totalPosts = await prisma.post.count({
		where: {
			authorId: { in: followingIds },
		},
	});

	res.status(200).json({
		success: true,
		posts: transformedPosts,
		pagination: {
			currentPage: page,
			totalPages: Math.ceil(totalPosts / limit),
			totalPosts,
			hasNext: page < Math.ceil(totalPosts / limit),
		},
	});
});

// GET /api/posts/:id - Get single post with comments
export const getPost = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user?.id;

	const post = await prisma.post.findUnique({
		where: { id: postId },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
			comments: {
				include: {
					author: {
						select: {
							id: true,
							username: true,
							profilePic: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
			},
			_count: {
				select: {
					likes: true,
					comments: true,
				},
			},
			...(userId && {
				likes: {
					where: { userId },
					select: { id: true },
				},
				savedPosts: {
					where: { userId },
					select: { id: true },
				},
			}),
		},
	});

	if (!post) {
		return next(new ErrorHandler('Post not found', 404));
	}

	const transformedPost = {
		...post,
		isLiked: userId ? post.likes?.length > 0 : false,
		isSaved: userId ? post.savedPosts?.length > 0 : false,
		likesCount: post._count.likes,
		commentsCount: post._count.comments,
		likes: undefined,
		savedPosts: undefined,
		_count: undefined,
	};

	res.status(200).json({
		success: true,
		post: transformedPost,
	});
});

// POST /api/posts/:id/like - Like/Unlike a post
export const toggleLike = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user.id;

	const existingLike = await prisma.like.findFirst({
		where: { postId, userId },
	});

	let isLiked;
	let likesCount;

	if (existingLike) {
		// Unlike the post
		await prisma.like.delete({
			where: { id: existingLike.id },
		});
		isLiked = false;
	} else {
		// Like the post
		await prisma.like.create({
			data: { postId, userId },
		});
		isLiked = true;
	}

	// Get updated likes count
	likesCount = await prisma.like.count({
		where: { postId },
	});

	res.status(200).json({
		success: true,
		isLiked,
		likesCount,
	});
});

// POST /api/posts/:id/comments - Add comment to post
export const addComment = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user.id;
	const { content } = req.body;

	if (!content?.trim()) {
		return next(new ErrorHandler('Comment content is required', 400));
	}

	const comment = await prisma.comment.create({
		data: {
			content: content.trim(),
			postId,
			authorId: userId,
		},
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
		},
	});

	res.status(201).json({
		success: true,
		comment,
	});
});

// PUT /api/posts/comments/:id - Update comment
export const updateComment = catchAsyncError(async (req, res, next) => {
	const commentId = parseInt(req.params.id);
	const userId = req.user.id;
	const { content } = req.body;

	if (!content?.trim()) {
		return next(new ErrorHandler('Comment content is required', 400));
	}

	const comment = await prisma.comment.findUnique({
		where: { id: commentId },
	});

	if (!comment) {
		return next(new ErrorHandler('Comment not found', 404));
	}

	if (comment.authorId !== userId) {
		return next(new ErrorHandler('Not authorized to update this comment', 403));
	}

	const updatedComment = await prisma.comment.update({
		where: { id: commentId },
		data: { content: content.trim() },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
		},
	});

	res.status(200).json({
		success: true,
		comment: updatedComment,
	});
});

// DELETE /api/posts/comments/:id - Delete comment
export const deleteComment = catchAsyncError(async (req, res, next) => {
	const commentId = parseInt(req.params.id);
	const userId = req.user.id;

	const comment = await prisma.comment.findUnique({
		where: { id: commentId },
	});

	if (!comment) {
		return next(new ErrorHandler('Comment not found', 404));
	}

	if (comment.authorId !== userId) {
		return next(new ErrorHandler('Not authorized to delete this comment', 403));
	}

	await prisma.comment.delete({
		where: { id: commentId },
	});

	res.status(200).json({
		success: true,
		message: 'Comment deleted successfully',
	});
});

// POST /api/posts/:id/save - Save/Unsave a post
export const toggleSavePost = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user.id;

	const existingSave = await prisma.savedPost.findFirst({
		where: { postId, userId },
	});

	let isSaved;

	if (existingSave) {
		// Unsave the post
		await prisma.savedPost.delete({
			where: { id: existingSave.id },
		});
		isSaved = false;
	} else {
		// Save the post
		await prisma.savedPost.create({
			data: { postId, userId },
		});
		isSaved = true;
	}

	res.status(200).json({
		success: true,
		isSaved,
	});
});

// GET /api/posts/saved - Get user's saved posts
export const getSavedPosts = catchAsyncError(async (req, res, next) => {
	const userId = req.user.id;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	const skip = (page - 1) * limit;

	const savedPosts = await prisma.savedPost.findMany({
		where: { userId },
		include: {
			post: {
				include: {
					author: {
						select: {
							id: true,
							username: true,
							profilePic: true,
						},
					},
					_count: {
						select: {
							likes: true,
							comments: true,
						},
					},
					likes: {
						where: { userId },
						select: { id: true },
					},
				},
			},
		},
		orderBy: { createdAt: 'desc' },
		skip,
		take: limit,
	});

	const transformedPosts = savedPosts.map((savedPost) => ({
		...savedPost.post,
		isLiked: savedPost.post.likes.length > 0,
		isSaved: true,
		likesCount: savedPost.post._count.likes,
		commentsCount: savedPost.post._count.comments,
		likes: undefined,
		_count: undefined,
	}));

	const totalSavedPosts = await prisma.savedPost.count({
		where: { userId },
	});

	res.status(200).json({
		success: true,
		posts: transformedPosts,
		pagination: {
			currentPage: page,
			totalPages: Math.ceil(totalSavedPosts / limit),
			totalPosts: totalSavedPosts,
			hasNext: page < Math.ceil(totalSavedPosts / limit),
		},
	});
});

// PUT /api/posts/:id - Update post (optional, for edit functionality)
export const updatePost = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user.id;
	const { content } = req.body;

	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		return next(new ErrorHandler('Post not found', 404));
	}

	if (post.authorId !== userId) {
		return next(new ErrorHandler('Not authorized to update this post', 403));
	}

	const updatedPost = await prisma.post.update({
		where: { id: postId },
		data: { content },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
			_count: {
				select: {
					likes: true,
					comments: true,
				},
			},
		},
	});

	res.status(200).json({
		success: true,
		post: updatedPost,
	});
});

// DELETE /api/posts/:id - Delete post
export const deletePost = catchAsyncError(async (req, res, next) => {
	const postId = parseInt(req.params.id);
	const userId = req.user.id;

	const post = await prisma.post.findUnique({
		where: { id: postId },
	});

	if (!post) {
		return next(new ErrorHandler('Post not found', 404));
	}

	if (post.authorId !== userId) {
		return next(new ErrorHandler('Not authorized to delete this post', 403));
	}

	// Delete associated images from cloudinary
	if (post.images && post.images.length > 0) {
		try {
			const deletePromises = post.images.map((imageUrl) => {
				const publicId = imageUrl.split('/').pop().split('.')[0];
				return deleteFromCloudinary(publicId);
			});
			await Promise.all(deletePromises);
		} catch (error) {
			console.error('Error deleting images from cloudinary:', error);
		}
	}

	await prisma.post.delete({
		where: { id: postId },
	});

	res.status(200).json({
		success: true,
		message: 'Post deleted successfully',
	});
});

// GET /api/posts/user/:userId - Get posts by specific user
export const getUserPosts = catchAsyncError(async (req, res, next) => {
	const targetUserId = parseInt(req.params.userId);
	const currentUserId = req.user?.id;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	const skip = (page - 1) * limit;

	const posts = await prisma.post.findMany({
		where: { authorId: targetUserId },
		include: {
			author: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
			_count: {
				select: {
					likes: true,
					comments: true,
				},
			},
			...(currentUserId && {
				likes: {
					where: { userId: currentUserId },
					select: { id: true },
				},
				savedPosts: {
					where: { userId: currentUserId },
					select: { id: true },
				},
			}),
		},
		orderBy: { createdAt: 'desc' },
		skip,
		take: limit,
	});

	const transformedPosts = posts.map((post) => ({
		...post,
		isLiked: currentUserId ? post.likes?.length > 0 : false,
		isSaved: currentUserId ? post.savedPosts?.length > 0 : false,
		likesCount: post._count.likes,
		commentsCount: post._count.comments,
		likes: undefined,
		savedPosts: undefined,
		_count: undefined,
	}));

	const totalPosts = await prisma.post.count({
		where: { authorId: targetUserId },
	});

	res.status(200).json({
		success: true,
		posts: transformedPosts,
		pagination: {
			currentPage: page,
			totalPages: Math.ceil(totalPosts / limit),
			totalPosts,
			hasNext: page < Math.ceil(totalPosts / limit),
		},
	});
});
