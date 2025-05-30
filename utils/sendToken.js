import jwt from 'jsonwebtoken';

export const generateToken = (res, user, message) => {
	const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, {
		expiresIn: process.env.JWT_EXPIRE,
	});

	res
		.status(200)
		.cookie('token', token, {
			expires: new Date(
				Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
			),
			httpOnly: true,
		})
		.json({
			success: true,
			user,
			message,
			token,
		});
};
