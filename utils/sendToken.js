import jwt from 'jsonwebtoken';

export const generateTokens = (user) => {
	const accessToken = jwt.sign(
		{ id: user.id },
		process.env.JWT_SECRET_KEY,
		{ expiresIn: '30m' } // Short lifespan
	);

	const refreshToken = jwt.sign(
		{ id: user.id },
		process.env.JWT_REFRESH_SECRET_KEY,
		{ expiresIn: '7d' } // Longer lifespan
	);

	return { accessToken, refreshToken };
};
