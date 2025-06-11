import prisma from '../database/db.config.js';
import { catchAsyncError } from '../middlewares/catchAsyncError.js';
import ErrorHandler from '../middlewares/error.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import fs from 'fs';

/// GET /api/users/:idOrUsername
export const getUserProfile = catchAsyncError(async (req, res, next) => {
	const { username } = req.params;

	const isNumeric = /^\d+$/.test(username);

	const user = await prisma.user.findFirst({
		where: isNumeric ? { id: Number(username) } : { username: username },
		select: {
			id: true,
			username: true,
			bio: true,
			profilePic: true,
			followers: { select: { id: true } },
			following: { select: { id: true } },
			posts: {
				select: {
					id: true,
					content: true,
					images: true,
					createdAt: true,
				},
			},
		},
	});

	if (!user) return next(new ErrorHandler('User not found', 404));

	res.status(200).json({
		success: true,
		user,
		followerCount: user.followers.length,
		followingCount: user.following.length,
	});
});
// PUT /api/users/profile

export const updateUserProfile = catchAsyncError(async (req, res, next) => {
	const userId = req.user.id;
	const { username, bio } = req.body;

	// Validate username uniqueness
	if (username) {
		const existingUser = await prisma.user.findFirst({
			where: { username, NOT: { id: userId } },
		});
		if (existingUser)
			return next(new ErrorHandler('Username already taken', 400));
	}

	// Upload image if file is provided
	let profilePicUrl = null;
	if (req.file) {
		const result = await uploadToCloudinary(req.file.path, 'avatars');
		profilePicUrl = result.secure_url;
		fs.unlinkSync(req.file.path);
	}

	// Update user in DB
	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			...(username && { username }),
			...(bio && { bio }),
			...(profilePicUrl && { profilePic: profilePicUrl }),
		},
	});

	res.status(200).json({
		success: true,
		message: 'Profile updated',
		user: updatedUser,
	});
});

// POST /api/users/:id/follow
export const followUser = catchAsyncError(async (req, res, next) => {
	const followerId = req.user.id;
	const followingId = Number(req.params.id);

	// Validate followingId is a valid number
	if (isNaN(followingId)) {
		return next(new ErrorHandler('Invalid user ID', 400));
	}

	if (followerId === followingId) {
		return next(new ErrorHandler("You can't follow yourself", 400));
	}

	const isFollowing = await prisma.follow.findFirst({
		where: { followerId, followingId },
	});

	if (isFollowing) {
		// Unfollow logic
		await prisma.follow.delete({ where: { id: isFollowing.id } });

		// Correct counts after unfollow
		const updatedFollowerCount = await prisma.follow.count({
			where: { followingId }, // followers of the unfollowed user
		});
		const updatedFollowingCount = await prisma.follow.count({
			where: { followerId }, // users the current user is following
		});

		return res.status(200).json({
			success: true,
			following: false,
			followerCount: updatedFollowerCount,
			followingCount: updatedFollowingCount,
		});
	} else {
		// Follow logic
		await prisma.follow.create({ data: { followerId, followingId } });

		// Correct counts after follow
		const updatedFollowerCount = await prisma.follow.count({
			where: { followingId }, // followers of the followed user
		});
		const updatedFollowingCount = await prisma.follow.count({
			where: { followerId }, // users the current user is following
		});

		return res.status(200).json({
			success: true,
			following: true,
			followerCount: updatedFollowerCount,
			followingCount: updatedFollowingCount,
		});
	}
});
// GET /api/users/:id/followers or /following
export const getUserFollowList = catchAsyncError(async (req, res, next) => {
	const userId = parseInt(req.params.id);
	const type = req.query.type; // "followers" or "following"

	if (!['followers', 'following'].includes(type)) {
		return next(new ErrorHandler('Invalid type', 400));
	}

	const relation = await prisma.follow.findMany({
		where:
			type === 'followers' ? { followingId: userId } : { followerId: userId },
		select: {
			[type === 'followers' ? 'follower' : 'following']: {
				select: {
					id: true,
					username: true,
					profilePic: true,
				},
			},
		},
	});

	const users =
		relation?.map((rel) =>
			type === 'followers' ? rel.follower : rel.following
		) || [];

	res.status(200).json({ success: true, users });
});

// GET /api/users/search?q=someText
export const searchUsers = catchAsyncError(async (req, res, next) => {
	const query = req.query.q?.trim();

	if (!query) {
		return res.status(200).json({ users: [] });
	}

	const users = await prisma.user.findMany({
		where: {
			OR: [
				{ username: { contains: query, mode: 'insensitive' } },
				{ bio: { contains: query, mode: 'insensitive' } },
			],
		},
		select: {
			id: true,
			username: true,
			profilePic: true,
		},
		take: 10,
	});

	res.status(200).json({ success: true, users });
});
